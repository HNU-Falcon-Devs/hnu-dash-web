import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatManila, isUuid } from "../../validation";
import {
  CreateCheckpointForm, EditCheckpointForm, DeleteCheckpointForm,
  type Checkpoint,
} from "./checkpoint-forms";

export const dynamic = "force-dynamic";

type ParentEvent = {
  id: string; title: string; starts_at: string; ends_at: string;
  state: string; roster_frozen_at: string | null;
};

export default async function EventCheckpointsPage({
  params,
}: { params: Promise<{ id: string; eventId: string }> }) {
  const { id: organizationId, eventId } = await params;
  if (!isUuid(organizationId) || !isUuid(eventId)) notFound();

  const auth = await getAuthState();
  if (auth.status === "signed-out") redirect("/login");
  if (auth.status === "denied") redirect("/login?error=access_denied");
  if (auth.status !== "authenticated") {
    return <main role="alert" className="p-8 text-center">Checkpoints are unavailable. We could not verify your account.</main>;
  }

  let event: ParentEvent | null = null;
  let checkpoints: Checkpoint[] = [];
  let eventError = false;
  let checkpointsError = false;
  let permissionError = false;
  let canManage = false;

  try {
    const client = await createClient();
    const parent = await client.from("events")
      .select("id,title,starts_at,ends_at,state,roster_frozen_at")
      .eq("organization_id", organizationId).eq("id", eventId).maybeSingle();
    eventError = Boolean(parent.error);
    if (!eventError && parent.data) {
      event = parent.data as ParentEvent;
      const [list, manager] = await Promise.all([
        client.from("event_checkpoints")
          .select("id,event_id,label,direction,opens_at,closes_at,sort_order")
          .eq("event_id", eventId).order("sort_order", { ascending: true })
          .order("opens_at", { ascending: true }),
        client.rpc("can_manage_org", { org_id: organizationId }),
      ]);
      checkpointsError = Boolean(list.error);
      if (!checkpointsError) checkpoints = (list.data ?? []) as Checkpoint[];
      permissionError = Boolean(manager.error);
      canManage = !permissionError && manager.data === true;
    }
  } catch {
    eventError = true;
  }

  if (!eventError && !event) notFound();

  const editable = event?.state === "DRAFT" && event.roster_frozen_at === null;
  const showControls = canManage && editable && !checkpointsError;
  const url = `/organizations/${organizationId}/events/${eventId}/checkpoints`;

  return (
    <AppShell userEmail={auth.email} activePath="/events">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href={`/organizations/${organizationId}/events`}
          className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400">Back to organization events</Link>
        {eventError || !event ? (
          <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
            Could not load this event. <Link href={url} className="underline">Retry</Link>
          </p>
        ) : (
          <>
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{event.title} — Checkpoints</h2>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <Badge variant={event.state === "DRAFT" ? "warning" : "default"}>{event.state}</Badge>
                <span>{formatManila(event.starts_at)} – {formatManila(event.ends_at)} (Asia/Manila)</span>
              </div>
            </div>
            {!editable && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Checkpoint changes are locked because this event is no longer an unfrozen DRAFT.
              </p>
            )}
            <div className={showControls ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.85fr)]" : "space-y-6"}>
              <Card>
                <CardHeader><CardTitle>Event checkpoints</CardTitle></CardHeader>
                <CardContent>
                  {checkpointsError ? (
                    <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
                      Could not load checkpoints. <Link href={url} className="underline">Retry</Link>
                    </p>
                  ) : checkpoints.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      No checkpoints are configured for this event.
                    </p>
                  ) : (
                    <ul aria-label="Event checkpoints" className="divide-y divide-slate-200 dark:divide-slate-800">
                      {checkpoints.map(checkpoint => (
                        <li key={checkpoint.id} className="space-y-3 py-5 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-semibold break-words">{checkpoint.label}</h3>
                            <Badge variant="outline">{checkpoint.direction}</Badge>
                          </div>
                          <dl className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                            <div><dt className="inline font-medium">Opens: </dt><dd className="inline">{formatManila(checkpoint.opens_at)}</dd></div>
                            <div><dt className="inline font-medium">Closes: </dt><dd className="inline">{formatManila(checkpoint.closes_at)}</dd></div>
                            <div><dt className="inline font-medium">Sort order: </dt><dd className="inline">{checkpoint.sort_order}</dd></div>
                          </dl>
                          {showControls && (
                            <div className="space-y-2">
                              <details className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                                <summary className="cursor-pointer text-sm font-medium text-emerald-700 dark:text-emerald-400">Edit checkpoint</summary>
                                <div className="mt-4">
                                  <EditCheckpointForm organizationId={organizationId} eventId={eventId}
                                    checkpoint={checkpoint} window={event} />
                                </div>
                              </details>
                              <details className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                                <summary className="cursor-pointer text-sm font-medium text-rose-700 dark:text-rose-400">Delete checkpoint</summary>
                                <div className="mt-4">
                                  <DeleteCheckpointForm organizationId={organizationId} eventId={eventId} checkpoint={checkpoint} />
                                </div>
                              </details>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              {showControls && (
                <Card>
                  <CardHeader><CardTitle>Add checkpoint</CardTitle></CardHeader>
                  <CardContent>
                    <CreateCheckpointForm organizationId={organizationId} eventId={eventId} window={event} />
                  </CardContent>
                </Card>
              )}
            </div>
            {permissionError && (
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
                Could not verify checkpoint-management permissions. Changes are unavailable.
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
