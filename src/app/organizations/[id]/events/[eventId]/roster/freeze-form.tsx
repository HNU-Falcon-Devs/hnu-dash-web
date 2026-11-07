"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { freezeEventRoster, type FreezeState } from "./actions";

const initial: FreezeState = { status: "idle", message: "" };

export function FreezeRosterForm({
  organizationId, eventId,
}: { organizationId: string; eventId: string }) {
  const [state, action, pending] = useActionState(freezeEventRoster, initial);
  return (
    <form action={action} aria-label="Freeze event roster" className="space-y-4">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="event_id" value={eventId} />
      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
        Freezing creates an immutable snapshot of active BSIT students matching this event&apos;s
        target year levels. The Backend verifies eligibility when you submit. Freezing is
        irreversible: there is no unfreeze or snapshot editing API. You also cannot edit the
        event draft or its checkpoints afterward. This does not publish the event or change its state to OPEN.
      </p>
      {state.status !== "success" && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirm_freeze" value="yes" required
            className="mt-1 accent-rose-600" />
          I have checked the event details and checkpoints, and understand this freeze cannot be undone.
        </label>
      )}
      {state.message && (
        <p role={state.status === "success" ? "status" : "alert"} aria-live="polite"
          className={state.status === "success" ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-rose-700 dark:text-rose-400"}>
          {state.message}
        </p>
      )}
      {state.status === "success" ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          The snapshot is ready. Refresh this page to inspect the frozen roster.
        </p>
      ) : (
        <Button type="submit" variant="danger" isLoading={pending}>Freeze roster permanently</Button>
      )}
    </form>
  );
}
