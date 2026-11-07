import { describe, expect, it } from "vitest";
import { MAX_ROSTER_ROWS, parseRosterCsv, validateRosterRows } from "./roster-csv";

const header = "student_id,full_name,program_code,year_level";
const record = (id: string, name = "Synthetic Student", program = "BSIT", year = "3") =>
  `${id},${name},${program},${year}`;

describe("CSV parsing and preview", () => {
  it("accepts correct headers and preserves leading-zero identifiers", () => {
    const result = parseRosterCsv(`${header}\n${record("00001")}\n${record("A-002", "Second Student", "BSIT", "1")}\n`);
    expect(result.errors).toEqual([]);
    expect(result.validCount).toBe(2);
    expect(result.rows).toEqual([
      { student_id: "00001", full_name: "Synthetic Student", program_code: "BSIT", year_level: 3 },
      { student_id: "A-002", full_name: "Second Student", program_code: "BSIT", year_level: 1 },
    ]);
  });

  it("supports BOM, CRLF, quoted commas, escaped quotes and multiline names", () => {
    const text = "\uFEFF" + header + '\r\n"0003","Doe, Jane",BSIT,2\r\n' +
      '"0004","Ana ""The Tester"" Cruz",BSIT,3\r\n' +
      '"0005","Row\nWith newline",BSIT,4\r\n';
    const result = parseRosterCsv(text);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].full_name).toBe("Doe, Jane");
    expect(result.rows[1].full_name).toBe('Ana "The Tester" Cruz');
    expect(result.rows[2].full_name).toBe("Row\nWith newline");
    expect(result.rows[0].student_id).toBe("0003");
  });

  it("rejects empty files, header-only files, swapped or extra headers", () => {
    expect(parseRosterCsv("").errors).toContain("CSV file is empty.");
    expect(parseRosterCsv(header).errors).toContain("Roster must contain at least one student.");
    expect(parseRosterCsv("full_name,student_id,program_code,year_level\n" + record("0001")).errors[0]).toContain("headers");
    expect(parseRosterCsv(header + ",active\n" + record("0001") + ",true").errors[0]).toContain("headers");
  });

  it("rejects unclosed quotes, stray quotes, junk after closing quotes and wrong column counts", () => {
    for (const text of [
      header + '\n"00001,Test,BSIT,1',
      header + '\n00001,Te"st,BSIT,1',
      header + '\n00001,"Test"junk,BSIT,1',
    ]) expect(parseRosterCsv(text).errors[0]).toMatch(/quote|quoted/i);
    expect(parseRosterCsv(header + "\n00001,Test,BSIT").errors[0]).toMatch(/invalid student record/);
    expect(parseRosterCsv(header + "\n00001,Test,BSIT,1,extra").errors[0]).toMatch(/invalid student record/);
  });

  it("reports duplicate IDs after whitespace normalization without listing identifiers in errors", () => {
    const result = parseRosterCsv(`${header}\n${record("00001")}\n 00001 ,Second Student,BSIT,4\n`);
    expect(result.validCount).toBe(1);
    expect(result.errors.some(e => e.includes("duplicate student ID"))).toBe(true);
    expect(JSON.stringify(result.errors)).not.toContain("00001");
  });

  it("rejects invalid ID characters and lengths", () => {
    for (const id of ["", "AB_1", "ABC 12", "A".repeat(65)]) {
      expect(parseRosterCsv(`${header}\n${record(id)}`).errors.join(" ")).toContain("student ID");
    }
    expect(parseRosterCsv(`${header}\n${record("X")}`).errors).toEqual([]);
  });

  it("rejects blank or long names, lowercase/short program codes, and bad year levels", () => {
    for (const name of ["   ", "N".repeat(161)]) {
      expect(parseRosterCsv(`${header}\n${record("0001", name)}`).errors.join(" ")).toContain("name");
    }
    for (const code of ["bSit", "B", "BS_IT", "X".repeat(33)]) {
      expect(parseRosterCsv(`${header}\n${record("0001", "Student", code)}`).errors.join(" ")).toContain("program code");
    }
    for (const year of ["0", "7", "01", "1.0", "three", ""]) {
      expect(parseRosterCsv(`${header}\n${record("0001", "Student", "BSIT", year)}`).errors.join(" ")).toContain("year level");
    }
  });

  it("accepts exactly 1,000 records but rejects 1,001 without partial import payload", () => {
    const body = Array.from({ length: MAX_ROSTER_ROWS }, (_, i) => record(String(i).padStart(5, "0")));
    const valid = parseRosterCsv([header, ...body].join("\n"));
    expect(valid.errors).toEqual([]);
    expect(valid.rows).toHaveLength(1000);
    const invalid = parseRosterCsv([header, ...body, record("OVER-LIMIT")].join("\n"));
    expect(invalid.rows).toEqual([]);
    expect(invalid.errors[0]).toContain("1,000");
  });
});

describe("server-side RPC payload validation", () => {
  const good = { student_id: "00001", full_name: "Test Person", program_code: "BSIT", year_level: 2 };

  it("revalidates an independently forged payload and normalizes trimming", () => {
    const result = validateRosterRows([{ ...good, student_id: " 00001 ", full_name: " Test Person " }]);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].student_id).toBe("00001");
    expect(result.rows[0].full_name).toBe("Test Person");
  });

  it("rejects non-arrays, bad fields, extra keys, nonnumeric years and duplicate IDs", () => {
    for (const payload of [
      {}, [], null,
      [{ ...good, year_level: "2" }],
      [{ ...good, active: true }],
      [{ ...good, full_name: null }],
      [good, { ...good }],
      [good, { ...good, student_id: " 00001 " }],
    ]) expect(validateRosterRows(payload).errors.length).toBeGreaterThan(0);
  });
});
