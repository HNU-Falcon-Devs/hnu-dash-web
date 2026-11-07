"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { importRoster, type ImportState } from "./actions";
import { MAX_CSV_BYTES, parseRosterCsv, type StudentRow, type RosterPreview } from "./roster-csv";

const initial: ImportState = { status: "idle", message: "" };

function ImportSubmission({ rows }: { rows: StudentRow[] }) {
  const [state, action, pending] = useActionState(importRoster, initial);
  return (
    <form action={action} aria-label="Confirm roster import" className="space-y-4">
      <input type="hidden" name="rows" value={JSON.stringify(rows)} readOnly />
      <p className="text-sm text-slate-700 dark:text-slate-300">
        Importing an existing student ID <strong>updates that student&apos;s name, program, and year level</strong>.
        Only proceed after verifying the source file and institutional approval.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm_import" value="yes" required
          className="mt-1 accent-emerald-700" />
        I have reviewed the preview and authorize importing or updating these {rows.length} records.
      </label>
      {state.message && (
        <p role={state.status === "success" ? "status" : "alert"} aria-live="polite"
          className={state.status === "success" ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-rose-700 dark:text-rose-400"}>
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={state.status === "success"} isLoading={pending}>
        {state.status === "success" ? "Import confirmed" : `Import ${rows.length} records`}
      </Button>
    </form>
  );
}

export function RosterImportForm() {
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);

  async function readFile(file?: File) {
    const next = ++sequence.current;
    setVersion(next);
    setPreview(null);
    setFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      setPreview({ rows: [], validCount: 0, errors: ["File exceeds the 1 MB import preview limit."] });
      return;
    }
    try {
      const content = await file.text();
      if (next !== sequence.current) return;
      setPreview(parseRosterCsv(content));
    } catch {
      if (next === sequence.current) {
        setPreview({ rows: [], validCount: 0, errors: ["Could not read the selected CSV file."] });
      }
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="roster-csv" className="mb-1.5 block text-sm font-medium">Student roster CSV</label>
        <input id="roster-csv" type="file" accept=".csv,text/csv"
          onChange={event => void readFile(event.currentTarget.files?.[0])}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-emerald-800 dark:border-slate-700 dark:bg-slate-900 dark:file:bg-emerald-950 dark:file:text-emerald-200" />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Columns in exact order: <code>student_id,full_name,program_code,year_level</code>.
          Up to 1,000 records. The CSV stays in this browser until you confirm import.
        </p>
      </div>
      {preview && (
        <div className="space-y-4">
          <p role="status" className="text-sm font-medium">
            {fileName}: {preview.validCount} valid records
            {preview.errors.length ? " — import blocked" : " — ready for review"}
          </p>
          {preview.errors.length > 0 && (
            <div role="alert" className="rounded-lg border border-rose-200 p-4 text-sm text-rose-700 dark:border-rose-900 dark:text-rose-300">
              <p className="font-semibold">Correct the CSV before importing:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {preview.errors.map((error, index) => <li key={index}>{error}</li>)}
              </ul>
            </div>
          )}
          {preview.rows.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Record preview ({preview.rows.length} valid rows)</h3>
              <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full min-w-[34rem] text-left text-xs sm:text-sm">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th scope="col" className="px-3 py-2">Student ID</th>
                      <th scope="col" className="px-3 py-2">Full name</th>
                      <th scope="col" className="px-3 py-2">Program</th>
                      <th scope="col" className="px-3 py-2">Year</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {preview.rows.map(row => (
                      <tr key={row.student_id}>
                        <td className="px-3 py-2 font-mono">{row.student_id}</td>
                        <td className="px-3 py-2 whitespace-pre-wrap">{row.full_name}</td>
                        <td className="px-3 py-2">{row.program_code}</td>
                        <td className="px-3 py-2">{row.year_level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {preview.errors.length === 0 && preview.rows.length > 0 && (
            <ImportSubmission key={version} rows={preview.rows} />
          )}
        </div>
      )}
    </div>
  );
}
