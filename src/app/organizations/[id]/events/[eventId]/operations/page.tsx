import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatManila, isUuid } from "../../validation";
import { AssignEventStaffForm, RevokeEventStaffForm, OpenEventForm } from "./operation-forms";
import { CoverageRefreshButton } from "./coverage-refresh-button";

export const dynamic = "force-dynamic";

const COVERAGE_PAGE_SIZE = 200;

type Event = {
  id: string;
  title: string;
  organization_id: string;
  state: string;
  starts_at: string;
  ends_at: string;
  roster_frozen_at: string | null;
  opened_at: string | null;
};
type Assignment = {
  id: string;
  event_id: string;
  staff_user_id: string;
  assigned_at: string;
  assigned_by: string;
  revoked_at: string | null;
  revoked_by: string | null;
};
type Member = { user_id: string };
type CheckpointWindow = {
  id: string;
  label: string;
  direction: string;
  sort_order: number;
  opens_at: string;
  closes_at: string;
};
type CoverageRow = {
  student_id: string;
  checkpoint_id: string;
  checkpoint_label: string;
  checkpoint_direction: string;
  checkpoint_sort_order: number;
  has_accepted_scan: boolean;
  accepted_received_at: string | null;
};
type OperationsSearchParams = Record<string, string | string[] | undefined>;

function parseCoveragePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) ? page : 1;
}

function coverageHref(
  root: string,
  searchParams: OperationsSearchParams,
  page: number,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "coverage_page" || value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach(item => query.append(key, item));
    } else {
      query.set(key, value);
    }
  }
  query.set("coverage_page", String(page));
  return root + "?" + query.toString();
}

function getCoverageErrorMessage(code: string | undefined): string {
  if (code === "42501") {
    return "Checkpoint coverage is unavailable for this account or event.";
  }
  if (code === "55000") {
    return "Checkpoint coverage requires a frozen event roster.";
  }
  if (code === "22023") {
    return "The checkpoint coverage request was invalid. Refresh the page to try again.";
  }
  if (code === "PGRST202" || code === "42883") {
    return "Checkpoint coverage is temporarily unavailable because the Backend capability could not be found.";
  }
  return "Could not load checkpoint coverage. Check your connection and try again.";
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

export default async function EventOperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; eventId: string }>;
  searchParams?: Promise<OperationsSearchParams>;
}) {
  const [{ id: orgId, eventId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ]);
  if (!isUuid(orgId) || !isUuid(eventId)) notFound();

  const auth = await getAuthState();
  if (auth.status === "signed-out") redirect("/login");
  if (auth.status === "denied") redirect("/login?error=access_denied");
  if (auth.status !== "authenticated") {
    return <main role="alert" className="p-8 text-center">Operations unavailable. HNU account verification failed.</main>;
  }

  let event: Event | null = null;
  let assignments: Assignment[] = [];
  let members: Member[] = [];
  let rosterCount: number | null = null;
  let checkpoints: CheckpointWindow[] = [];
  let errorMessage = "";
  let eventMissing = false;
  let managerAuthorized = false;
  let client: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    client = await createClient();
    const permission = await client.rpc("can_manage_org", { org_id: orgId });
    if (permission.error) {
      errorMessage = "Could not verify event-management permissions. Operations are unavailable.";
    } else if (permission.data !== true) {
      errorMessage = "Only authorized organization Leaders and platform Administrators may manage event operations.";
    } else {
      managerAuthorized = true;
      const found = await client.from("events")
        .select("id,title,organization_id,state,starts_at,ends_at,roster_frozen_at,opened_at")
        .eq("organization_id", orgId).eq("id", eventId).maybeSingle();
      if (found.error) {
        errorMessage = "Could not load event operations. The Milestone 2 Backend may not be available yet.";
      } else if (!found.data) {
        eventMissing = true;
      } else {
        event = found.data as Event;
        const [list, staff, windows, roster] = await Promise.all([
          client.from("event_staff")
            .select("id,event_id,staff_user_id,assigned_at,assigned_by,revoked_at,revoked_by")
            .eq("event_id", eventId).order("assigned_at", { ascending: false }),
          client.from("organization_memberships")
            .select("user_id").eq("organization_id", orgId)
            .eq("role", "staff").eq("active", true)
            .order("user_id", { ascending: true }),
          client.from("event_checkpoints")
            .select("id,label,direction,sort_order,opens_at,closes_at").eq("event_id", eventId)
            .order("sort_order", { ascending: true }),
          event.roster_frozen_at
            ? client.from("event_roster")
              .select("student_id", { count: "exact", head: true }).eq("event_id", eventId)
            : Promise.resolve({ count: null, error: null }),
        ]);
        if (list.error || staff.error || windows.error || roster.error
            || !Array.isArray(list.data) || !Array.isArray(staff.data)
            || !Array.isArray(windows.data)
            || (event.roster_frozen_at && roster.count === null)) {
          errorMessage = "Could not verify Staff assignments or activation readiness. The Milestone 2 Backend may not be deployed yet.";
        } else {
          assignments = list.data as Assignment[];
          members = staff.data as Member[];
          checkpoints = windows.data as CheckpointWindow[];
          rosterCount = roster.count;
        }
      }
    }
  } catch {
    errorMessage = "Could not load event operations. Check your connection and Backend availability.";
  }
  if (eventMissing) notFound();

  const totalEvidenceSlots = rosterCount === null ? null : rosterCount * checkpoints.length;
  const pageCount = totalEvidenceSlots === null
    ? 0
    : Math.ceil(totalEvidenceSlots / COVERAGE_PAGE_SIZE);
  const requestedCoveragePage = parseCoveragePage(query.coverage_page);
  const coveragePage = pageCount > 0
    ? Math.min(requestedCoveragePage, pageCount)
    : 1;
  const coverageOffset = (coveragePage - 1) * COVERAGE_PAGE_SIZE;

  let coverageRows: CoverageRow[] = [];
  let coverageErrorMessage = "";
  let coverageLoaded = false;
  const coveragePrerequisitesMet = Boolean(
    managerAuthorized && !errorMessage && event?.roster_frozen_at
      && rosterCount !== null && rosterCount > 0 && checkpoints.length > 0
  );

  if (coveragePrerequisitesMet && client) {
    try {
      const result = await client.rpc("get_event_checkpoint_coverage", {
        eid: eventId,
        p_limit: COVERAGE_PAGE_SIZE,
        p_offset: coverageOffset,
      });
      if (result.error) {
        coverageErrorMessage = getCoverageErrorMessage(result.error.code);
      } else if (Array.isArray(result.data)) {
        coverageRows = result.data as unknown as CoverageRow[];
        coverageLoaded = true;
      } else {
        coverageErrorMessage = "The Backend returned an unexpected checkpoint coverage response.";
      }
    } catch {
      coverageErrorMessage = "Could not load checkpoint coverage. Check your connection and try again.";
    }
  }

  const pageCheckpointStats = getPageCheckpointStats(coverageRows);
  const active = assignments.filter(a => a.revoked_at === null);
  const revoked = assignments.filter(a => a.revoked_at !== null);
  const assignedUsers = new Set(active.map(a => a.staff_user_id));
  const candidates = members.filter(m => !assignedUsers.has(m.user_id));
  const start = event ? Date.parse(event.starts_at) : NaN;
  const end = event ? Date.parse(event.ends_at) : NaN;
  const validWindows = Number.isFinite(start) && Number.isFinite(end) && start < end
    && checkpoints.length > 0 && checkpoints.every(c => {
      const opens = Date.parse(c.opens_at);
      const closes = Date.parse(c.closes_at);
      return Number.isFinite(opens) && Number.isFinite(closes)
        && opens >= start && closes <= end && opens < closes;
    });
  const canOpen = !errorMessage && event?.state === "DRAFT"
    && Boolean(event.roster_frozen_at) && (rosterCount ?? 0) > 0 && validWindows;
  const root = "/organizations/" + orgId + "/events/" + eventId + "/operations";
  const pageStart = coverageOffset + 1;
  const pageEnd = coverageOffset + coverageRows.length;

  return (
    <AppShell userEmail={auth.email} activePath="/events">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href={"/organizations/" + orgId + "/events"}
          className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400">
          Back to organization events
        </Link>
        {errorMessage ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
            {errorMessage} <Link href={root} className="underline">Retry</Link>
          </p>
        ) : event ? (
          <>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{event.title} — Operations</h2>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={event.state === "DRAFT" ? "warning" : "default"}>{event.state}</Badge>
                <Badge variant={event.roster_frozen_at ? "success" : "outline"}>
                  {event.roster_frozen_at ? "Frozen roster" : "Roster not frozen"}
                </Badge>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {formatManila(event.starts_at)} – {formatManila(event.ends_at)} (Asia/Manila)
              </p>
              {event.opened_at && <p className="text-sm">Opened at: {formatManila(event.opened_at)}</p>}
              <div className="flex flex-wrap gap-4 text-sm">
                <Link href={"/organizations/" + orgId + "/events/" + eventId + "/checkpoints"}
                  className="font-medium text-emerald-700 underline dark:text-emerald-400">View checkpoints</Link>
                <Link href={"/organizations/" + orgId + "/events/" + eventId + "/roster"}
                  className="font-medium text-emerald-700 underline dark:text-emerald-400">Manage roster</Link>
              </div>
            </div>

            <Card>
              <CardHeader><CardTitle>Event activation</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>Current state: <strong>{event.state}</strong>. The Backend alone activates events.</p>
                <p>Frozen roster: {event.roster_frozen_at
                  ? "Yes (" + formatManila(event.roster_frozen_at) + ")"
                  : "No — freeze the roster before activation."}</p>
                <p>Frozen roster entries: {rosterCount === null ? "Not frozen" : rosterCount}</p>
                <p>Configured checkpoints: {checkpoints.length} ({validWindows ? "valid schedule windows" : "not ready"})</p>
                <p>Assigned Staff: {active.length}. There is no minimum Staff count required to open.</p>
                {canOpen ? (
                  <OpenEventForm organizationId={orgId} eventId={eventId} />
                ) : event.state === "DRAFT" ? (
                  <p role="status" className="text-amber-700 dark:text-amber-300">
                    Activation is unavailable until the roster is frozen, nonempty, and checkpoints are valid.
                  </p>
                ) : (
                  <p>Activation is only available for DRAFT events; repeated OPEN requests are not permitted.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>Provisional checkpoint coverage</CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Read-only accepted online scan evidence against the frozen roster.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">Provisional</Badge>
                    {coveragePrerequisitesMet && <CoverageRefreshButton />}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 text-sm">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <p className="text-slate-600 dark:text-slate-400">Frozen roster entries</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {rosterCount === null ? "Not frozen" : rosterCount.toLocaleString("en-PH")}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <p className="text-slate-600 dark:text-slate-400">Configured checkpoints</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{checkpoints.length.toLocaleString("en-PH")}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <p className="text-slate-600 dark:text-slate-400">Evidence combinations</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {totalEvidenceSlots === null ? "Unavailable" : totalEvidenceSlots.toLocaleString("en-PH")}
                    </p>
                  </div>
                </div>

                {!event.roster_frozen_at ? (
                  <p role="status" className="text-amber-700 dark:text-amber-300">
                    Checkpoint coverage becomes available after the event roster is frozen.
                  </p>
                ) : checkpoints.length === 0 ? (
                  <p role="status" className="text-slate-600 dark:text-slate-300">
                    No checkpoints are configured for this event.
                  </p>
                ) : rosterCount === 0 ? (
                  <p role="status" className="text-slate-600 dark:text-slate-300">
                    No frozen roster entries are available for checkpoint coverage.
                  </p>
                ) : coverageErrorMessage ? (
                  <p role="alert" className="text-rose-700 dark:text-rose-400">
                    {coverageErrorMessage} <Link href={coverageHref(root, query, coveragePage)} className="underline">Retry</Link>
                  </p>
                ) : coverageLoaded && coverageRows.length === 0 ? (
                  <p role="status" className="text-slate-600 dark:text-slate-300">
                    No checkpoint evidence rows are available on this page.
                  </p>
                ) : coverageLoaded ? (
                  <>
                    <section aria-labelledby="coverage-page-stats-title" className="space-y-3">
                      <div>
                        <h4 id="coverage-page-stats-title" className="font-semibold">Checkpoint statistics on this page</h4>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          Accepted receipts / rows returned for each checkpoint on this page only. These are not event-wide totals.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {pageCheckpointStats.map(stat => (
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
                          Showing rows {pageStart.toLocaleString("en-PH")}–{pageEnd.toLocaleString("en-PH")} of {totalEvidenceSlots?.toLocaleString("en-PH")} evidence combinations.
                        </p>
                      </div>
                      <Table>
                        <caption className="sr-only">Provisional accepted online scan evidence by student and checkpoint</caption>
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
                          {coverageRows.map((row, index) => (
                            <TableRow key={row.student_id + ":" + row.checkpoint_id + ":" + index}>
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
                                    ? <time dateTime={row.accepted_received_at}>{formatManila(row.accepted_received_at)}</time>
                                    : "Receipt timestamp unavailable"
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </section>

                    {pageCount > 1 && (
                      <nav aria-label="Checkpoint coverage pagination"
                        className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Page {coveragePage.toLocaleString("en-PH")} of {pageCount.toLocaleString("en-PH")} · {coverageRows.length.toLocaleString("en-PH")} rows on this page
                        </p>
                        <div className="flex items-center gap-3">
                          {coveragePage > 1 ? (
                            <Link href={coverageHref(root, query, coveragePage - 1)}
                              aria-label="Previous coverage page"
                              className="font-medium text-emerald-700 underline dark:text-emerald-400">
                              Previous
                            </Link>
                          ) : (
                            <span aria-disabled="true" className="text-slate-400">Previous</span>
                          )}
                          {coveragePage < pageCount ? (
                            <Link href={coverageHref(root, query, coveragePage + 1)}
                              aria-label="Next coverage page"
                              className="font-medium text-emerald-700 underline dark:text-emerald-400">
                              Next
                            </Link>
                          ) : (
                            <span aria-disabled="true" className="text-slate-400">Next</span>
                          )}
                        </div>
                      </nav>
                    )}
                  </>
                ) : null}

                <p className="text-xs text-slate-600 dark:text-slate-400" role="note">
                  Coverage is provisional and may change as new accepted receipts arrive. Each page is read separately; pages do not form one atomic snapshot. No accepted receipt recorded is not an official attendance status.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Attendance Staff</CardTitle></CardHeader>
              <CardContent className="space-y-5 text-sm">
                <p className="text-slate-600 dark:text-slate-300">
                  Staff require an active organization Staff membership AND an active event assignment.
                  Accounts are shown by Auth UUID; no names or private email directory is available.
                </p>
                {active.length === 0 ? (
                  <p>No active Staff assignments for this event.</p>
                ) : (
                  <ul aria-label="Active event Staff" className="divide-y divide-slate-200 dark:divide-slate-800">
                    {active.map(a => (
                      <li key={a.id} className="space-y-2 py-4 first:pt-0">
                        <p className="break-all font-mono">{a.staff_user_id}</p>
                        <p className="text-slate-600 dark:text-slate-300">
                          Assigned: {formatManila(a.assigned_at)} · By: <span className="break-all font-mono">{a.assigned_by}</span>
                        </p>
                        <RevokeEventStaffForm organizationId={orgId} eventId={eventId}
                          assignmentId={a.id} staffId={a.staff_user_id} />
                      </li>
                    ))}
                  </ul>
                )}
                {["DRAFT", "OPEN"].includes(event.state) ? (
                  candidates.length > 0 ? (
                    <AssignEventStaffForm organizationId={orgId} eventId={eventId} candidates={candidates} />
                  ) : (
                    <p>No unassigned active Staff memberships are visible in this organization.</p>
                  )
                ) : <p>New assignments are unavailable in this event state.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Revoked assignment history</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {revoked.length === 0 ? <p>No revoked assignments.</p> : (
                  <ul aria-label="Revoked Staff assignment history" className="divide-y divide-slate-200 dark:divide-slate-800">
                    {revoked.map(a => (
                      <li key={a.id} className="space-y-1 py-3 first:pt-0">
                        <p className="break-all font-mono">{a.staff_user_id}</p>
                        <p>Assigned: {formatManila(a.assigned_at)} · Revoked: {a.revoked_at ? formatManila(a.revoked_at) : "Unknown"}</p>
                        <p className="break-all text-slate-600 dark:text-slate-300">Revoked by: {a.revoked_by ?? "Unknown"}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        ) : <p role="alert">Event operations could not be loaded.</p>}
      </div>
    </AppShell>
  );
}
