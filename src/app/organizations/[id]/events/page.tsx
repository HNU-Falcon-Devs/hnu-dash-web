import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid, formatManila } from "./validation";
import { CreateDraftEventForm, EditDraftEventForm } from "./event-form";

export const dynamic = "force-dynamic";

type Org = { id: string; name: string; slug: string };
type Event = {
  id: string; organization_id: string; title: string; starts_at: string;
  ends_at: string; target_year_levels: number[]; state: string; roster_frozen_at: string | null;
};

export default async function OrganizationEventsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const auth = await getAuthState();
  if (auth.status === "signed-out") redirect("/login");
  if (auth.status === "denied") redirect("/login?error=access_denied");
  if (auth.status !== "authenticated") {
    return <main role="alert" className="p-8 text-center">Events are unavailable. We could not verify your account.</main>;
  }

  let organization: Org | null = null;
  let events: Event[] = [];
  let organizationError = false;
  let eventError = false;
  let permissionError = false;
  let canManage = false;

  try {
    const supabase = await createClient();
    const org = await supabase.from("organizations").select("id,name,slug")
      .eq("id", id).maybeSingle();
    organizationError = Boolean(org.error);
    if (!organizationError && org.data) {
      organization = org.data as Org;
      const [list, manager] = await Promise.all([
        supabase.from("events").select("id,organization_id,title,starts_at,ends_at,target_year_levels,state,roster_frozen_at")
          .eq("organization_id", id).order("starts_at", { ascending: true }),
        supabase.rpc("can_manage_org", { org_id: id }),
      ]);
      eventError = Boolean(list.error);
      if (!eventError) events = (list.data ?? []) as Event[];
      permissionError = Boolean(manager.error);
      canManage = !permissionError && manager.data === true;
    }
  } catch {
    organizationError = true;
  }
  if (!organizationError && !organization) notFound();

  return (
    <AppShell userEmail={auth.email} activePath="/events">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/events" className="font-medium text-emerald-700 underline dark:text-emerald-400">All event organizations</Link>
          <Link href={`/organizations/${id}`} className="font-medium text-emerald-700 underline dark:text-emerald-400">Organization details</Link>
        </div>
        {organizationError || !organization ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
            Could not load this organization. <Link href={`/organizations/${id}/events`} className="underline">Retry</Link>
          </p>
        ) : (
          <>
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{organization.name} — Events</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {organization.slug} · Dates and times shown in Philippine time (Asia/Manila).
              </p>
            </div>
            <div className={canManage ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.85fr)]" : "space-y-6"}>
              <Card>
                <CardHeader><CardTitle>Organization events</CardTitle></CardHeader>
                <CardContent>
                  {eventError ? (
                    <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
                      Could not load events. <Link href={`/organizations/${id}/events`} className="underline">Retry</Link>
                    </p>
                  ) : events.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">No events are visible in this organization.</p>
                  ) : (
                    <ul aria-label="Organization events" className="divide-y divide-slate-200 dark:divide-slate-800">
                      {events.map(event => (
                        <li key={event.id} className="space-y-3 py-5 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-semibold break-words">{event.title}</h3>
                            <Badge variant={event.state === "DRAFT" ? "warning" : "default"}>{event.state}</Badge>
                          </div>
                          <dl className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <div><dt className="inline font-medium">Starts: </dt><dd className="inline">{formatManila(event.starts_at)}</dd></div>
                            <div><dt className="inline font-medium">Ends: </dt><dd className="inline">{formatManila(event.ends_at)}</dd></div>
                            <div><dt className="inline font-medium">Target years: </dt><dd className="inline">{event.target_year_levels.join(", ")}</dd></div>
                          </dl>
                          <Link href={`/organizations/${id}/events/${event.id}/checkpoints`}
                            className="inline-block text-sm font-medium text-emerald-700 underline dark:text-emerald-400">
                            View checkpoints
                          </Link>
                          {canManage && (
                            <Link href={`/organizations/${id}/events/${event.id}/roster`}
                              className="ml-4 inline-block text-sm font-medium text-emerald-700 underline dark:text-emerald-400">
                              Manage roster
                            </Link>
                          )}
                          {canManage && (
                            <Link href={`/organizations/${id}/events/${event.id}/operations`}
                              className="ml-4 inline-block text-sm font-medium text-emerald-700 underline dark:text-emerald-400">
                              Manage Staff &amp; activation
                            </Link>
                          )}
                          {canManage && event.state === "DRAFT" && event.roster_frozen_at === null && (
                            <details className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                              <summary className="cursor-pointer text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                Edit draft
                              </summary>
                              <div className="mt-4"><EditDraftEventForm organizationId={id} event={event} /></div>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              {canManage && (
                <Card>
                  <CardHeader><CardTitle>Create draft event</CardTitle></CardHeader>
                  <CardContent><CreateDraftEventForm organizationId={id} /></CardContent>
                </Card>
              )}
            </div>
            {permissionError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
              Could not verify event-management permissions. Create and edit controls are unavailable.
            </p>}
          </>
        )}
      </div>
    </AppShell>
  );
}
