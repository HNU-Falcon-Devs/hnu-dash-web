import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatManila, isUuid } from "../../validation";
import { AssignEventStaffForm, RevokeEventStaffForm, OpenEventForm } from "./operation-forms";

export const dynamic = "force-dynamic";

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
type CheckpointWindow = { id: string; opens_at: string; closes_at: string };

export default async function EventOperationsPage({
  params,
}: {
  params: Promise<{ id: string; eventId: string }>;
}) {
  const { id: orgId, eventId } = await params;
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

  try {
    const client = await createClient();
    const permission = await client.rpc("can_manage_org", { org_id: orgId });
    if (permission.error) {
      errorMessage = "Could not verify event-management permissions. Operations are unavailable.";
    } else if (permission.data !== true) {
      errorMessage = "Only authorized organization Leaders and platform Administrators may manage event operations.";
    } else {
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
            .select("id,opens_at,closes_at").eq("event_id", eventId),
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
