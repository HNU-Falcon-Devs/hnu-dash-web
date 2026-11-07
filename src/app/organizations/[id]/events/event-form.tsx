"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { createDraftEvent, updateDraftEvent, type EventActionState } from "./actions";
import { asManilaInput } from "./validation";

const initialState: EventActionState = { status: "idle", message: "" };
const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

type FormEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  target_year_levels: number[];
};

function EventFields({ event }: { event?: FormEvent }) {
  const prefix = event ? `edit-${event.id}` : "create";
  return (
    <>
      <div>
        <label htmlFor={`${prefix}-title`} className="mb-1.5 block text-sm font-medium">Event title</label>
        <input id={`${prefix}-title`} name="title" type="text" required minLength={2} maxLength={160}
          defaultValue={event?.title} className={inputClass} placeholder="e.g. Department General Assembly" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-start`} className="mb-1.5 block text-sm font-medium">Starts (Philippine time)</label>
          <input id={`${prefix}-start`} name="starts_at" type="datetime-local" required
            defaultValue={event ? asManilaInput(event.starts_at) : undefined} className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${prefix}-end`} className="mb-1.5 block text-sm font-medium">Ends (Philippine time)</label>
          <input id={`${prefix}-end`} name="ends_at" type="datetime-local" required
            defaultValue={event ? asManilaInput(event.ends_at) : undefined} className={inputClass} />
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Target year levels</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {[1, 2, 3, 4, 5, 6].map(year => (
            <label key={year} className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="year_levels" value={year}
                defaultChecked={event ? event.target_year_levels.includes(year) : year <= 4}
                className="accent-emerald-700" />
              Year {year}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Times use Asia/Manila (UTC+08:00). Events remain DRAFT; no publishing or roster freezing.
      </p>
    </>
  );
}

export function CreateDraftEventForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(createDraftEvent, initialState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} aria-label="Create draft event" className="space-y-4">
      <input type="hidden" name="organization_id" value={organizationId} />
      <EventFields />
      {state.message && <p role={state.status === "success" ? "status" : "alert"}
        className={state.status === "success" ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-rose-700 dark:text-rose-400"}>{state.message}</p>}
      <Button type="submit" isLoading={pending}>Create draft event</Button>
    </form>
  );
}

export function EditDraftEventForm({ organizationId, event }: { organizationId: string; event: FormEvent }) {
  const [state, action, pending] = useActionState(updateDraftEvent, initialState);
  return (
    <form action={action} aria-label={`Edit draft event ${event.title}`} className="space-y-4">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="event_id" value={event.id} />
      <EventFields event={event} />
      {state.message && <p role={state.status === "success" ? "status" : "alert"}
        className={state.status === "success" ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-rose-700 dark:text-rose-400"}>{state.message}</p>}
      <Button type="submit" size="sm" isLoading={pending}>Save draft changes</Button>
    </form>
  );
}
