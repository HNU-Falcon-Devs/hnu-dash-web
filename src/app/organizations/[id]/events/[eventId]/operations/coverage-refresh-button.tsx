"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CoverageRow = {
  student_id: string;
  checkpoint_id: string;
  checkpoint_label: string;
  checkpoint_direction: string;
  checkpoint_sort_order: number;
  has_accepted_scan: boolean;
  accepted_received_at: string | null;
};

type CoverageRefreshResult = { rows: CoverageRow[] } | { error: string };
type CoverageRefreshAction = () => Promise<CoverageRefreshResult>;

type Props = {
  initialRows: CoverageRow[];
  offlineEnabled?: boolean;
  initialError: string;
  refreshAction: CoverageRefreshAction;
  page: number;
  pageCount: number;
  pageStart: number;
  totalEvidenceSlots: number;
  previousHref?: string;
  nextHref?: string;
};

function formatManilaTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function getPageCheckpointStats(rows: CoverageRow[]) {
  const stats = new Map<string, {
    checkpointId: string;
    label: string;
    direction: string;
    sortOrder: number;
    total: number;
    accepted: number;
  }>();

  for (const row of rows) {
    const current = stats.get(row.checkpoint_id);
    if (current) {
      current.total += 1;
      if (row.has_accepted_scan) current.accepted += 1;
    } else {
      stats.set(row.checkpoint_id, {
        checkpointId: row.checkpoint_id,
        label: row.checkpoint_label,
        direction: row.checkpoint_direction,
        sortOrder: row.checkpoint_sort_order,
        total: 1,
        accepted: row.has_accepted_scan ? 1 : 0,
      });
    }
  }

  return Array.from(stats.values()).sort((a, b) =>
    a.sortOrder - b.sortOrder || a.checkpointId.localeCompare(b.checkpointId)
  );
}

export function CoverageEvidencePanel({
  initialRows,
  offlineEnabled = false,
  initialError,
  refreshAction,
  page,
  pageCount,
  pageStart,
  totalEvidenceSlots,
  previousHref,
  nextHref,
}: Props) {
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState(initialError);
  const [isPending, startTransition] = useTransition();
  const stats = getPageCheckpointStats(rows);
  const pageEnd = pageStart + rows.length - 1;

  function refresh() {
    startTransition(async () => {
      try {
        const result = await refreshAction();
        if ("error" in result) {
          setError(result.error);
        } else {
          setRows(result.rows);
          setError("");
        }
      } catch {
        setError("Could not refresh checkpoint coverage. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="space-y-5 text-sm">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          isLoading={isPending}
          onClick={refresh}
          aria-label="Refresh checkpoint coverage"
        >
          {isPending ? "Refreshing…" : "Refresh coverage"}
          <span aria-live="polite" className="sr-only">
            {isPending ? "Refreshing checkpoint coverage" : ""}
          </span>
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-rose-700 dark:text-rose-400">
          {error}{rows.length > 0 ? " Previously loaded results remain displayed." : ""}
        </p>
      )}

      {!error && rows.length === 0 && (
        <p role="status" className="text-slate-600 dark:text-slate-300">
          No checkpoint evidence rows are available on this page.
        </p>
      )}

      {rows.length > 0 && (
        <>
          <section aria-labelledby="coverage-page-stats-title" className="space-y-3">
            <div>
              <h4 id="coverage-page-stats-title" className="font-semibold">Checkpoint statistics on this page</h4>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Accepted receipts / rows returned for each checkpoint on this page only. These are not event-wide totals.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map(stat => (
                <div key={stat.checkpointId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="font-medium">{stat.label} <span className="text-slate-500">({stat.direction})</span></p>
                  <p className="mt-1 tabular-nums">
                    <strong>{stat.accepted} / {stat.total}</strong>
                    <span className="text-slate-600 dark:text-slate-400"> accepted / rows shown</span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="coverage-evidence-title" className="space-y-3">
            <div>
              <h4 id="coverage-evidence-title" className="font-semibold">Student/checkpoint evidence</h4>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Showing rows {pageStart.toLocaleString("en-PH")}–{pageEnd.toLocaleString("en-PH")} of {totalEvidenceSlots.toLocaleString("en-PH")} evidence combinations.
              </p>
            </div>
            <Table>
              <caption className="sr-only">{offlineEnabled ? "Provisional accepted canonical evidence by student and checkpoint" : "Provisional accepted online scan evidence by student and checkpoint"}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Student ID</TableHead>
                  <TableHead scope="col">Checkpoint</TableHead>
                  <TableHead scope="col">Direction</TableHead>
                  <TableHead scope="col">Evidence</TableHead>
                  <TableHead scope="col">Backend received at (Asia/Manila)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow key={row.student_id + ":" + row.checkpoint_id}>
                    <TableCell><code className="whitespace-nowrap font-mono">{row.student_id}</code></TableCell>
                    <TableCell>{row.checkpoint_label}</TableCell>
                    <TableCell><Badge variant="outline">{row.checkpoint_direction}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={row.has_accepted_scan ? "success" : "outline"}>
                        {row.has_accepted_scan
                          ? "Accepted receipt recorded"
                          : "No accepted receipt recorded"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.has_accepted_scan
                        ? row.accepted_received_at
                          ? <time dateTime={row.accepted_received_at}>{formatManilaTimestamp(row.accepted_received_at)}</time>
                          : "Receipt timestamp unavailable"
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </>
      )}

      {pageCount > 1 && (
        <nav aria-label="Checkpoint coverage pagination"
          className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Page {page.toLocaleString("en-PH")} of {pageCount.toLocaleString("en-PH")} · {rows.length.toLocaleString("en-PH")} rows on this page
          </p>
          <div className="flex items-center gap-3">
            {previousHref ? (
              <Link href={previousHref} aria-label="Previous coverage page"
                className="font-medium text-emerald-700 underline dark:text-emerald-400">
                Previous
              </Link>
            ) : (
              <span aria-disabled="true" className="text-slate-400">Previous</span>
            )}
            {nextHref ? (
              <Link href={nextHref} aria-label="Next coverage page"
                className="font-medium text-emerald-700 underline dark:text-emerald-400">
                Next
              </Link>
            ) : (
              <span aria-disabled="true" className="text-slate-400">Next</span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
