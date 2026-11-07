export const ROSTER_HEADERS = ["student_id", "full_name", "program_code", "year_level"] as const;
export const MAX_ROSTER_ROWS = 1000;
export const MAX_CSV_BYTES = 1_000_000;

export type StudentRow = {
  student_id: string;
  full_name: string;
  program_code: string;
  year_level: number;
};

export type RosterPreview = {
  rows: StudentRow[];
  validCount: number;
  errors: string[];
};

function validationError(errors: string[], message: string) {
  if (errors.length < 30) errors.push(message);
}

/** Validate the RPC payload independently of CSV input, including forged Server Action data. */
export function validateRosterRows(input: unknown, lineNumbers?: number[]): RosterPreview {
  const errors: string[] = [];
  const rows: StudentRow[] = [];
  if (!Array.isArray(input) || input.length === 0) {
    return { rows, validCount: 0, errors: ["Roster must contain at least one student."] };
  }
  if (input.length > MAX_ROSTER_ROWS) {
    return { rows, validCount: 0, errors: ["Maximum 1,000 students per import."] };
  }

  const seen = new Set<string>();
  for (let index = 0; index < input.length; index++) {
    const line = lineNumbers?.[index] ?? index + 2;
    const value = input[index];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      validationError(errors, `Line ${line}: invalid student record.`);
      continue;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length !== 4 || ROSTER_HEADERS.some(key => !keys.includes(key))) {
      validationError(errors, `Line ${line}: expected exactly four student fields.`);
      continue;
    }

    const studentId = typeof record.student_id === "string" ? record.student_id.trim() : "";
    const fullName = typeof record.full_name === "string" ? record.full_name.trim() : "";
    const programCode = typeof record.program_code === "string" ? record.program_code.trim() : "";
    const year = record.year_level;
    let valid = true;
    if (!/^[A-Za-z0-9-]{1,64}$/.test(studentId)) {
      validationError(errors, `Line ${line}: student ID must use 1–64 letters, numbers or hyphens.`);
      valid = false;
    }
    if (fullName.length < 1 || fullName.length > 160) {
      validationError(errors, `Line ${line}: name must contain 1–160 characters.`);
      valid = false;
    }
    if (!/^[A-Z0-9-]{2,32}$/.test(programCode)) {
      validationError(errors, `Line ${line}: program code must use 2–32 uppercase letters, numbers or hyphens.`);
      valid = false;
    }
    if (typeof year !== "number" || !Number.isInteger(year) || year < 1 || year > 6) {
      validationError(errors, `Line ${line}: year level must be a number from 1 to 6.`);
      valid = false;
    }
    if (seen.has(studentId)) {
      validationError(errors, `Line ${line}: duplicate student ID within this import.`);
      valid = false;
    }
    seen.add(studentId);
    if (valid) rows.push({ student_id: studentId, full_name: fullName,
      program_code: programCode, year_level: year as number });
  }

  if (errors.length === 30) errors.push("Further errors may exist; correct the file and validate again.");
  return { rows, validCount: rows.length, errors };
}

type CsvRecord = { values: string[]; line: number };

/** Strict RFC-style quoted CSV parser; retains leading zeros and quoted commas/newlines. */
function splitCsv(text: string): CsvRecord[] {
  const source = text.replace(/^\uFEFF/, "");
  const records: CsvRecord[] = [];
  let values: string[] = [];
  let cell = "";
  let quoted = false;
  let afterQuote = false;
  let line = 1;
  let recordLine = 1;

  function finishCell() { values.push(cell); cell = ""; afterQuote = false; }
  function finishRecord() {
    finishCell();
    if (!(values.length === 1 && values[0] === "")) {
      records.push({ values, line: recordLine });
    }
    values = [];
    recordLine = line + 1;
  }

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') { cell += '"'; index++; }
        else { quoted = false; afterQuote = true; }
      } else {
        cell += char;
        if (char === "\n" || (char === "\r" && source[index + 1] !== "\n")) line++;
      }
      continue;
    }
    if (char === "," || char === "\r" || char === "\n") {
      if (char === ",") finishCell();
      else {
        if (char === "\r" && source[index + 1] === "\n") index++;
        finishRecord();
        line++;
      }
      continue;
    }
    if (afterQuote) throw new Error(`Line ${line}: unexpected character after a quoted field.`);
    if (char === '"') {
      if (cell.length > 0) throw new Error(`Line ${line}: unexpected quote inside an unquoted field.`);
      quoted = true;
    } else cell += char;
  }
  if (quoted) throw new Error(`Line ${recordLine}: unterminated quoted field.`);
  if (cell.length || values.length || afterQuote) finishRecord();
  return records;
}

export function parseRosterCsv(text: string): RosterPreview {
  let records: CsvRecord[];
  try {
    records = splitCsv(text);
  } catch (error) {
    return { rows: [], validCount: 0,
      errors: [error instanceof Error ? error.message : "Malformed CSV file."] };
  }

  if (!records.length) return { rows: [], validCount: 0, errors: ["CSV file is empty."] };
  if (records[0].values.length !== ROSTER_HEADERS.length ||
      records[0].values.some((field, index) => field !== ROSTER_HEADERS[index])) {
    return { rows: [], validCount: 0,
      errors: [`CSV headers must be exactly: ${ROSTER_HEADERS.join(",")}`] };
  }

  const data = records.slice(1);
  if (data.length > MAX_ROSTER_ROWS) {
    return { rows: [], validCount: 0, errors: ["Maximum 1,000 students per import."] };
  }
  const input: unknown[] = data.map(({ values }) => {
    if (values.length !== ROSTER_HEADERS.length) return null;
    const year = values[3].trim();
    return {
      student_id: values[0],
      full_name: values[1],
      program_code: values[2],
      year_level: /^[1-6]$/.test(year) ? Number(year) : year,
    };
  });

  return validateRosterRows(input, data.map(item => item.line));
}
