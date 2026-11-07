import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatManila, isUuid } from "../../validation";
import { FreezeRosterForm } from "./freeze-form";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 100;

type Event = {
  id: string; title: string; organization_id: string;
  starts_at: string; ends_at: string; state: string;
  target_year_levels: number[]; roster_frozen_at: string | null;
};
type Snapshot = {
  student_id: string; student_name: string; program_code: string;
  year_level: number; frozen_at: string;
};

export default async function EventRosterPage({
  params, searchParams,
}: {
  params: Promise<{ id: string; eventId: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const { id: orgId, eventId } = await params;
  if (!isUuid(orgId) || !isUuid(eventId)) notFound();

  const auth = await getAuthState();
  if (auth.status === "signed-out") redirect("/login");
  if (auth.status === "denied") redirect("/login?error=access_denied");
  if (auth.status !== "authenticated") {
    return <main role="alert" className="p-8 text-center">Roster unavailable. HNU account verification failed.</main>;
  }

  const pageText = (await searchParams)?.page ?? "1";
  const page = /^[1-9]\d{0,5}$/.test(pageText) ? Number(pageText) : 1;
  let event: Event | null = null;
  let organizationName = "";
  let checkpointCount: number | null = null;
  let snapshot: Snapshot[] = [];
  let snapshotCount: number | null = null;
  let eventError = false, permissionError = false, checklistError = false, rosterError = false;
  let canManage = false;

  try {
    const client = await createClient();
    const found = await client.from("events")
      .select("id,title,organization_id,starts_at,ends_at,state,target_year_levels,roster_frozen_at")
      .eq("organization_id", orgId).eq("id", eventId).maybeSingle();
    eventError = Boolean(found.error);
    if (!eventError && found.data) {
      event = found.data as Event;
      const manager = await client.rpc("can_manage_org", { org_id: orgId });
      permissionError = Boolean(manager.error);
      canManage = !permissionError && manager.data === true;

      if (canManage) {
        const [organization, checkpoints] = await Promise.all([
          client.from("organizations").select("name").eq("id", orgId).maybeSingle(),
          client.from("event_checkpoints").select("id", { count: "exact", head: true }).eq("event_id", eventId),
        ]);
        if (organization.error || !organization.data) checklistError = true;
        else organizationName = organization.data.name as string;
        if (checkpoints.error || checkpoints.count === null) checklistError = true;
        else checkpointCount = checkpoints.count;

        // Do not fetch student snapshots for Staff, ordinary users, or when permission checking fails.
        if (event.roster_frozen_at !== null) {
          const result = await client.from("event_roster")
            .select("student_id,student_name,program_code,year_level,frozen_at", { count: "exact" })
            .eq("event_id", eventId).order("student_id", { ascending: true })
            .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
          rosterError = Boolean(result.error);
          if (!rosterError) {
            snapshot = (result.data ?? []) as Snapshot[];
            snapshotCount = result.count;
            if (snapshotCount === null) rosterError = true;
          }
        }
      }
    }
  } catch {
    eventError = true;
  }
  if (!eventError && !event) notFound();

  const frozen = event?.roster_frozen_at !== null && event?.roster_frozen_at !== undefined;
  const editable = event?.state === "DRAFT" && !frozen;
  const ready = canManage && editable && !checklistError && checkpointCount !== null && checkpointCount > 0;
  const root = `/organizations/${orgId}/events/${eventId}/roster`;
  const lastPage = Math.max(1, Math.ceil((snapshotCount ?? 0) / PAGE_SIZE));

  return (
    <AppShell userEmail={auth.email} activePath="/events">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href={`/organizations/${orgId}/events`}
          className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400">
          Back to organization events
        </Link>
        {eventError || !event ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
            Could not load event roster details. <Link href={root} className="underline">Retry</Link>
          </p>
        ) : !canManage ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
            {permissionError ? "Could not verify roster-management permissions." :
              "Only authorized organization leaders and platform administrators may view or freeze event rosters."}
          </p>
        ) : (
          <>
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{event.title} — Roster</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {organizationName || "Organization unavailable"} · {formatManila(event.starts_at)} – {formatManila(event.ends_at)} (Asia/Manila)
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={event.state === "DRAFT" ? "warning" : "default"}>{event.state}</Badge>
                <Badge variant={frozen ? "success" : "outline"}>{frozen ? "Frozen roster" : "Not frozen"}</Badge>
              </div>
            </div>
            <Card>
              <CardHeader><CardTitle>Roster readiness</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p>Target year levels: {event.target_year_levels.join(", ")}</p>
                <p>Configured checkpoints: {checkpointCount === null ? "Unavailable" : checkpointCount}</p>
                <p>Eligible students: not available for preview. The Backend checks for active BSIT students
                  in the selected year levels when freezing.</p>
                {event.roster_frozen_at && <p>Frozen at: {formatManila(event.roster_frozen_at)}</p>}
                {checklistError && <p role="alert" className="text-rose-700 dark:text-rose-300">
                  Could not verify organization or checkpoint readiness. Freezing is unavailable.
                </p>}
                {!frozen && checkpointCount === 0 && <p>
                  At least one checkpoint is required. <Link href={`/organizations/${orgId}/events/${eventId}/checkpoints`}
                    className="font-semibold text-emerald-700 underline dark:text-emerald-400">Configure checkpoints</Link>
                </p>}
                {!editable && !frozen && <p>This event is not an editable DRAFT. Freezing is unavailable.</p>}
              </CardContent>
            </Card>
            {ready && (
              <Card>
                <CardHeader><CardTitle>Freeze roster</CardTitle></CardHeader>
                <CardContent><FreezeRosterForm organizationId={orgId} eventId={eventId} /></CardContent>
              </Card>
            )}
            {frozen && (
              <Card>
                <CardHeader><CardTitle>Frozen student snapshot</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {rosterError ? (
                    <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">Could not load frozen roster. <Link href={root} className="underline">Retry</Link></p>
                  ) : snapshotCount === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">No snapshot entries are visible.</p>
                  ) : (
                    <>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {snapshotCount === null ? "Count unavailable" : `${snapshotCount} students in frozen snapshot`}.
                        Read-only records, with no edit or delete controls.
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                        <table className="w-full min-w-[35rem] text-left text-sm">
                          <thead className="bg-slate-100 dark:bg-slate-800"><tr>
                            <th scope="col" className="px-3 py-2">Student ID</th>
                            <th scope="col" className="px-3 py-2">Name</th>
                            <th scope="col" className="px-3 py-2">Program</th>
                            <th scope="col" className="px-3 py-2">Year</th>
                          </tr></thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {snapshot.map(row => (
                              <tr key={row.student_id}>
                                <td className="px-3 py-2 font-mono">{row.student_id}</td>
                                <td className="px-3 py-2">{row.student_name}</td>
                                <td className="px-3 py-2">{row.program_code}</td>
                                <td className="px-3 py-2">{row.year_level}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <span>Page {page} of {lastPage}</span>
                        {page > 1 && <Link href={`${root}?page=${page - 1}`} className="font-medium text-emerald-700 underline dark:text-emerald-400">Previous</Link>}
                        {page < lastPage && <Link href={`${root}?page=${page + 1}`} className="font-medium text-emerald-700 underline dark:text-emerald-400">Next</Link>}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
