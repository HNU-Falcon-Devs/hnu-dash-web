import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatManila, isUuid } from "../../validation";

export type FinalizedResult = {
  event_id: string;
  student_id: string;
  status: "PRESENT" | "INCOMPLETE" | "ABSENT";
  required_checkpoint_count: number;
  accepted_checkpoint_count: number;
  finalized_at: string;
  finalized_by: string;
};

// Validate the transport shape only. Never reconstruct the classification
// from coverage pages or locally calculated counts.
export function parseFinalizedResults(data: unknown, eventId: string, limit: number): FinalizedResult[] | null {
  if (!Array.isArray(data) || data.length > limit) return null;
  const ids = new Set<string>();
  let audit: { time: string; actor: string } | undefined;
  for (const value of data) {
    if (!value || typeof value !== "object") return null;
    const row = value as Record<string, unknown>;
    if (row.event_id !== eventId
      || typeof row.student_id !== "string" || row.student_id.length === 0 || ids.has(row.student_id)
      || !["PRESENT", "INCOMPLETE", "ABSENT"].includes(String(row.status))
      || typeof row.status !== "string"
      || typeof row.required_checkpoint_count !== "number"
      || !Number.isSafeInteger(row.required_checkpoint_count) || row.required_checkpoint_count < 1
      || typeof row.accepted_checkpoint_count !== "number"
      || !Number.isSafeInteger(row.accepted_checkpoint_count) || row.accepted_checkpoint_count < 0
      || row.accepted_checkpoint_count > row.required_checkpoint_count
      || typeof row.finalized_at !== "string" || !Number.isFinite(Date.parse(row.finalized_at))
      || !isUuid(row.finalized_by)) return null;
    if (audit && (audit.time !== row.finalized_at || audit.actor !== row.finalized_by)) return null;
    audit = { time: row.finalized_at, actor: row.finalized_by };
    ids.add(row.student_id);
  }
  return data as FinalizedResult[];
}

export function FinalizedResults({
  rows, error, page, pageCount, rosterCount, previousHref, nextHref, reloadHref,
}: {
  rows: FinalizedResult[]; error: string; page: number; pageCount: number;
  rosterCount: number | null; previousHref?: string; nextHref?: string; reloadHref: string;
}) {
  const first = rows[0];
  return (
    <Card>
      <CardHeader><CardTitle>Finalized prototype results</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>Backend-persisted, immutable synthetic-only classifications. These are not institution-approved attendance results.</p>
        {error ? (
          <p role="alert">{error} <a href={reloadHref} className="underline">Reload finalized results</a></p>
        ) : !first ? (
          <p role="status">No finalized result rows were returned. This is not an attendance verdict. <a href={reloadHref} className="underline">Reload finalized results</a></p>
        ) : (
          <>
            <dl className="space-y-1">
              <div><dt className="font-medium">Finalized at (Asia/Manila)</dt><dd><time dateTime={first.finalized_at}>{formatManila(first.finalized_at)}</time></dd></div>
              <div><dt className="font-medium">Finalized by (Auth UUID)</dt><dd className="break-all font-mono">{first.finalized_by}</dd></div>
            </dl>
            <Table>
              <caption className="sr-only">Finalized prototype attendance results</caption>
              <TableHeader><TableRow>
                <TableHead scope="col">Student ID</TableHead>
                <TableHead scope="col">Prototype status</TableHead>
                <TableHead scope="col">Required checkpoints</TableHead>
                <TableHead scope="col">Accepted checkpoints</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(row => <TableRow key={row.student_id}>
                  <TableCell><code>{row.student_id}</code></TableCell>
                  <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                  <TableCell>{row.required_checkpoint_count}</TableCell>
                  <TableCell>{row.accepted_checkpoint_count}</TableCell>
                </TableRow>)}
              </TableBody>
            </Table>
          </>
        )}
        {pageCount > 0 && (
          <nav aria-label="Finalized results pagination" className="flex flex-wrap items-center justify-between gap-3">
            <p>Page {page} of {pageCount} · {rows.length} rows returned · {rosterCount} frozen roster entries</p>
            <div className="flex gap-3">
              {previousHref && <Link href={previousHref} aria-label="Previous results page" className="underline">Previous</Link>}
              {nextHref && <Link href={nextHref} aria-label="Next results page" className="underline">Next</Link>}
            </div>
          </nav>
        )}
      </CardContent>
    </Card>
  );
}
