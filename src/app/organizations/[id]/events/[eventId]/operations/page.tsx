import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatManila, isUuid } from "../../validation";
import { AssignEventStaffForm, RevokeEventStaffForm, OpenEventForm, EventLifecycleForm } from "./operation-forms";
import { OfflinePanel } from "./offline-panel";
import { validPolicy, type EventPolicy } from "./offline-contract";
import { readOfflineEvidence } from "./offline-data";
import { CoverageEvidencePanel } from "./coverage-refresh-button";
import { FinalizedResults, parseFinalizedResults, type FinalizedResult } from "./finalized-results";

export const dynamic = "force-dynamic";

const COVERAGE_PAGE_SIZE = 200;

type Event = EventPolicy & {
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

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) ? page : 1;
}

function pageHref(
  root: string,
  searchParams: OperationsSearchParams,
  page: number,
  pageKey = "coverage_page",
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === pageKey || value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach(item => query.append(key, item));
    } else {
      query.set(key, value);
    }
  }
  query.set(pageKey, String(page));
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

export default async function EventOperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; eventId: string }>;
  searchParams?: Promise<OperationsSearchParams>;
}) {
  const [{ id: orgId, eventId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve<OperationsSearchParams>({}),
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
        .select("id,title,organization_id,state,starts_at,ends_at,roster_frozen_at,opened_at,offline_enabled,offline_upload_cutoff")
        .eq("organization_id", orgId).eq("id", eventId).maybeSingle();
      if (found.error) {
        errorMessage = "Could not load event operations. The Milestone 2 Backend may not be available yet.";
      } else if (!found.data || found.data.id !== eventId || found.data.organization_id !== orgId) {
        eventMissing = true;
      } else if (!validPolicy(found.data)) {
        errorMessage = "Could not verify the event offline policy. Reload operations.";
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
  const requestedCoveragePage = parsePage(query.coverage_page);
  const coveragePage = pageCount > 0
    ? Math.min(requestedCoveragePage, pageCount)
    : 1;
  const coverageOffset = (coveragePage - 1) * COVERAGE_PAGE_SIZE;

  let coverageRows: CoverageRow[] = [];
  let coverageErrorMessage = "";
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
      } else {
        coverageErrorMessage = "The Backend returned an unexpected checkpoint coverage response.";
      }
    } catch {
      coverageErrorMessage = "Could not load checkpoint coverage. Check your connection and try again.";
    }
  }

  // Re-authorize and refresh only this page's evidence, not the full Operations route.
  async function refreshCoveragePage(): Promise<{ rows: CoverageRow[] } | { error: string }> {
    "use server";

    try {
      const refreshedAuth = await getAuthState();
      if (refreshedAuth.status !== "authenticated") {
        return { error: "Checkpoint coverage is unavailable for this account or event." };
      }

      const refreshClient = await createClient();
      const permission = await refreshClient.rpc("can_manage_org", { org_id: orgId });
      if (permission.error || permission.data !== true) {
        return { error: "Checkpoint coverage is unavailable for this account or event." };
      }

      const scoped = await refreshClient.from("events").select("id,organization_id")
        .eq("organization_id", orgId).eq("id", eventId).maybeSingle();
      if (scoped.error || !scoped.data || scoped.data.id !== eventId || scoped.data.organization_id !== orgId) {
        return { error: "Checkpoint coverage is unavailable for this account or event." };
      }

      const result = await refreshClient.rpc("get_event_checkpoint_coverage", {
        eid: eventId,
        p_limit: COVERAGE_PAGE_SIZE,
        p_offset: coverageOffset,
      });
      if (result.error) {
        return { error: getCoverageErrorMessage(result.error.code) };
      }
      if (Array.isArray(result.data)) {
        return { rows: result.data as unknown as CoverageRow[] };
      }
      return { error: "The Backend returned an unexpected checkpoint coverage response." };
    } catch {
      return { error: "Could not refresh checkpoint coverage. Check your connection and try again." };
    }
  }

  // The immutable result RPC is separate from provisional coverage.
  // Bound the offset using the already-authorized frozen-roster count.
  const resultPageCount = rosterCount !== null && Number.isSafeInteger(rosterCount)
    && rosterCount > 0 && rosterCount <= 2147483647
    ? Math.ceil(rosterCount / COVERAGE_PAGE_SIZE) : 0;
  const resultPage = Math.min(parsePage(query.results_page), Math.max(1, resultPageCount));
  let finalizedRows: FinalizedResult[] = [];
  let finalizedError = "";
  if (managerAuthorized && !errorMessage && event?.state === "FINALIZED" && client) {
    if (!event.roster_frozen_at || resultPageCount === 0) {
      finalizedError = "Could not verify the frozen roster for finalized results. Reload to check Backend records.";
    } else {
      try {
        const result = await client.rpc("get_event_finalized_results", {
          eid: eventId, p_limit: COVERAGE_PAGE_SIZE,
          p_offset: (resultPage - 1) * COVERAGE_PAGE_SIZE,
        });
        if (result.error) {
          finalizedError = result.error.code === "42501"
            ? "Finalized results are unavailable for this account or event."
            : result.error.code === "55000"
              ? "The Backend did not confirm a finalized event. Reload to verify event state."
              : result.error.code === "22023"
                ? "The finalized results request was invalid. Reload to try again."
                : "Could not load finalized results. Reload to check Backend availability.";
        } else {
          const rows = parseFinalizedResults(result.data, eventId, COVERAGE_PAGE_SIZE);
          if (rows === null) finalizedError = "The Backend returned an unexpected finalized results response.";
          else finalizedRows = rows;
        }
      } catch {
        finalizedError = "Could not load finalized results. Reload to check Backend availability.";
      }
    }
  }

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
  const closureReady = Boolean(event?.roster_frozen_at && event.opened_at
    && (rosterCount ?? 0) > 0 && checkpoints.length > 0
    && checkpoints.every(c => Number.isFinite(Date.parse(c.closes_at))));
  const lastWindowEnd = closureReady
    ? checkpoints.reduce((latest, point) =>
      Date.parse(point.closes_at) > Date.parse(latest) ? point.closes_at : latest,
      checkpoints[0].closes_at)
    : null;
  const root = "/organizations/" + orgId + "/events/" + eventId + "/operations";
  const pageStart = coverageOffset + 1;
  const offlineEvidence = managerAuthorized && !errorMessage && event?.offline_enabled && client
    ? await readOfflineEvidence(client, event, query.preparations_page, query.claims_page) : null;

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

            {!event.offline_enabled && <OfflinePanel key={event.id + ":" + event.state + ":" + event.offline_enabled} event={event}
              organizationId={orgId} evidence={offlineEvidence} root={root} query={query}
              coverageReady={coveragePrerequisitesMet && !coverageErrorMessage && coverageRows.length > 0} />}

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
                  <OpenEventForm key={event.id + ":open:" + event.offline_enabled} organizationId={orgId} eventId={eventId} offlineEnabled={event.offline_enabled} />
                ) : event.state === "DRAFT" ? (
                  <p role="status" className="text-amber-700 dark:text-amber-300">
                    Activation is unavailable until the roster is frozen, nonempty, and checkpoints are valid.
                  </p>
                ) : (
                  <p>Activation is only available for DRAFT events; repeated OPEN requests are not permitted.</p>
                )}
              </CardContent>
            </Card>

            {event.state === "OPEN" && (
              <Card>
                <CardHeader><CardTitle>Close online evidence</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>All checkpoint windows must end before closure. The Backend verifies server time, readiness and permissions.</p>
                  {lastWindowEnd && <p>Last checkpoint closes: <time dateTime={lastWindowEnd}>{formatManila(lastWindowEnd)}</time> (Asia/Manila).</p>}
                  {closureReady
                    ? <EventLifecycleForm key={event.id + ":close"} organizationId={orgId} eventId={eventId} kind="close" />
                    : <p role="status">Closure requires an opened event, a nonempty frozen roster and configured checkpoints.</p>}
                </CardContent>
              </Card>
            )}
            {event.state === "SYNCING" && (
              <p role="status" className="text-sm">
                SYNCING — closed to new online evidence; awaiting organizer review. This is not offline synchronization completion.
              </p>
            )}

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>Provisional checkpoint coverage</CardTitle>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {event.offline_enabled ? "Read-only accepted canonical receipts (online and individually approved offline) against the frozen roster." : "Read-only accepted online scan evidence against the frozen roster."}
                    </p>
                  </div>
                  <Badge variant="warning">Provisional</Badge>
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
                ) : coveragePrerequisitesMet ? (
                  <CoverageEvidencePanel
                    key={eventId + ":" + event.state + ":" + coveragePage}
                    initialRows={coverageRows}
                    initialError={coverageErrorMessage}
                    refreshAction={refreshCoveragePage}
                    page={coveragePage}
                    pageCount={pageCount}
                    pageStart={pageStart}
                    totalEvidenceSlots={totalEvidenceSlots ?? 0}
                    previousHref={coveragePage > 1
                      ? pageHref(root, query, coveragePage - 1)
                      : undefined}
                    nextHref={coveragePage < pageCount
                      ? pageHref(root, query, coveragePage + 1)
                      : undefined}
                  />
                ) : null}

                <p className="text-xs text-slate-600 dark:text-slate-400" role="note">
                  Coverage is provisional and may change as new accepted receipts arrive. Each page is read separately; pages do not form one atomic snapshot. No accepted receipt recorded is not an official attendance status.
                </p>
              </CardContent>
            </Card>

            {event.offline_enabled && <OfflinePanel key={event.id + ":" + event.state + ":" + event.offline_enabled} event={event}
              organizationId={orgId} evidence={offlineEvidence} root={root} query={query}
              coverageReady={coveragePrerequisitesMet && !coverageErrorMessage && coverageRows.length > 0} />}

            {event.state === "SYNCING" && !event.offline_enabled && (
              <Card>
                <CardHeader><CardTitle>Finalize prototype attendance</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>Review the provisional coverage above before finalizing. All configured checkpoints are required for this synthetic-only prototype.</p>
                  {coveragePrerequisitesMet && !coverageErrorMessage && coverageRows.length > 0
                    ? <EventLifecycleForm key={event.id + ":finalize"} organizationId={orgId} eventId={eventId} kind="finalize" />
                    : <p role="status">Reload event operations to obtain evidence for review before finalizing. <a href={pageHref(root, query, coveragePage)} className="underline">Reload evidence</a></p>}
                </CardContent>
              </Card>
            )}

            {event.state === "FINALIZED" && (
              <FinalizedResults rows={finalizedRows} error={finalizedError}
                page={resultPage} pageCount={resultPageCount} rosterCount={rosterCount}
                previousHref={resultPage > 1 ? pageHref(root, query, resultPage - 1, "results_page") : undefined}
                nextHref={resultPage < resultPageCount ? pageHref(root, query, resultPage + 1, "results_page") : undefined}
                reloadHref={pageHref(root, query, resultPage, "results_page")} />
            )}

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
