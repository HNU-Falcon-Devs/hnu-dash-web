"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { formatManila } from "../../validation";
import {
  assignEventStaff, revokeEventStaff, activateEvent, type OperationState,
} from "./actions";

const initial: OperationState = { status: "idle", message: "" };
const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

function Feedback({ state }: { state: OperationState }) {
  if (!state.message) return null;
  return <p role={state.status === "success" ? "status" : "alert"} aria-live="polite"
    className={state.status === "success"
      ? "text-sm text-emerald-700 dark:text-emerald-300"
      : "text-sm text-rose-700 dark:text-rose-400"}>{state.message}</p>;
}

export function AssignEventStaffForm({
  organizationId, eventId, candidates,
}: { organizationId: string; eventId: string; candidates: { user_id: string }[] }) {
  const [state, action, pending] = useActionState(assignEventStaff, initial);
  return (
    <form action={action} aria-label="Assign event Staff" className="space-y-3">
      <input name="organization_id" type="hidden" value={organizationId} />
      <input name="event_id" type="hidden" value={eventId} />
      <label htmlFor="event-staff-user" className="block font-medium">Assign active organization Staff</label>
      <select id="event-staff-user" name="staff_user_id" required defaultValue="" className={fieldClass}>
        <option value="" disabled>Choose an Auth user UUID</option>
        {candidates.map(member => <option key={member.user_id} value={member.user_id}>{member.user_id}</option>)}
      </select>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Active membership is a candidate only. The Backend also verifies account status and HNU email.
      </p>
      <Feedback state={state} />
      <Button type="submit" size="sm" isLoading={pending}>Assign to event</Button>
    </form>
  );
}

export function RevokeEventStaffForm({
  organizationId, eventId, assignmentId, staffId,
}: { organizationId: string; eventId: string; assignmentId: string; staffId: string }) {
  const [state, action, pending] = useActionState(revokeEventStaff, initial);
  return (
    <form action={action} aria-label={"Revoke Staff assignment " + staffId} className="space-y-2">
      <input name="organization_id" type="hidden" value={organizationId} />
      <input name="event_id" type="hidden" value={eventId} />
      <input name="assignment_id" type="hidden" value={assignmentId} />
      {state.status !== "success" && (
        <label className="flex items-start gap-2">
          <input type="checkbox" name="confirm_revoke" value="yes" required className="mt-1 accent-rose-600" />
          Confirm revocation. This stops new authorized online access for this event.
        </label>
      )}
      <Feedback state={state} />
      {state.status !== "success" && (
        <Button type="submit" size="sm" variant="danger" isLoading={pending}>Revoke assignment</Button>
      )}
    </form>
  );
}

export function OpenEventForm({
  organizationId, eventId,
}: { organizationId: string; eventId: string }) {
  const [state, action, pending] = useActionState(activateEvent, initial);
  return (
    <form action={action} aria-label="Activate event" className="space-y-3">
      <input name="organization_id" type="hidden" value={organizationId} />
      <input name="event_id" type="hidden" value={eventId} />
      <p className="text-slate-600 dark:text-slate-300">
        Opening changes DRAFT to OPEN. The frozen roster and checkpoints cannot be edited afterward.
        This does not start scanning, synchronization, or attendance reconciliation.
      </p>
      {state.status !== "success" && (
        <label className="flex items-start gap-2">
          <input type="checkbox" name="confirm_open" value="yes" required className="mt-1 accent-emerald-700" />
          I verified the roster and checkpoint readiness and want to open this event.
        </label>
      )}
      <Feedback state={state} />
      {state.status === "success" && state.openedAt ? (
        <p role="status" className="font-medium text-emerald-700 dark:text-emerald-300">
          Authoritative state: OPEN · Opened at: {formatManila(state.openedAt)}
        </p>
      ) : (
        <Button type="submit" isLoading={pending}>Activate DRAFT event</Button>
      )}
    </form>
  );
}
