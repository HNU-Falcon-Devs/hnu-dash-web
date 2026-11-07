"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { asManilaInput } from "../../validation";
import {
  createCheckpoint, updateCheckpoint, deleteCheckpoint,
  type CheckpointActionState,
} from "./actions";

const initial: CheckpointActionState = { status: "idle", message: "" };
const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export type Checkpoint = {
  id: string;
  event_id: string;
  label: string;
  direction: "IN" | "OUT";
  opens_at: string;
  closes_at: string;
  sort_order: number;
};

type EventWindow = { starts_at: string; ends_at: string };

function CheckpointFields({ checkpoint, window }: { checkpoint?: Checkpoint; window: EventWindow }) {
  const prefix = checkpoint ? `checkpoint-${checkpoint.id}` : "new-checkpoint";
  return (
    <>
      <div>
        <label htmlFor={`${prefix}-label`} className="mb-1.5 block text-sm font-medium">Label</label>
        <input id={`${prefix}-label`} name="label" required type="text" minLength={2} maxLength={80}
          defaultValue={checkpoint?.label} placeholder="e.g. Morning entry"
          className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-direction`} className="mb-1.5 block text-sm font-medium">Direction</label>
          <select id={`${prefix}-direction`} name="direction" defaultValue={checkpoint?.direction ?? "IN"}
            className={inputClass}>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${prefix}-order`} className="mb-1.5 block text-sm font-medium">Sort order</label>
          <input id={`${prefix}-order`} name="sort_order" type="number" required step={1}
            min={-2147483648} max={2147483647} defaultValue={checkpoint?.sort_order ?? 0}
            className={inputClass} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-open`} className="mb-1.5 block text-sm font-medium">Opens (Philippine time)</label>
          <input id={`${prefix}-open`} name="opens_at" type="datetime-local" required
            min={asManilaInput(window.starts_at)} max={asManilaInput(window.ends_at)}
            defaultValue={checkpoint ? asManilaInput(checkpoint.opens_at) : undefined}
            className={inputClass} />
        </div>
        <div>
          <label htmlFor={`${prefix}-close`} className="mb-1.5 block text-sm font-medium">Closes (Philippine time)</label>
          <input id={`${prefix}-close`} name="closes_at" type="datetime-local" required
            min={asManilaInput(window.starts_at)} max={asManilaInput(window.ends_at)}
            defaultValue={checkpoint ? asManilaInput(checkpoint.closes_at) : undefined}
            className={inputClass} />
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Windows must fit inside the parent event schedule. Times use Asia/Manila (UTC+08:00).
        IN-only events are allowed.
      </p>
    </>
  );
}

function Feedback({ state }: { state: CheckpointActionState }) {
  if (!state.message) return null;
  return <p role={state.status === "success" ? "status" : "alert"} aria-live="polite"
    className={state.status === "success"
      ? "text-sm text-emerald-700 dark:text-emerald-300"
      : "text-sm text-rose-700 dark:text-rose-400"}>{state.message}</p>;
}

export function CreateCheckpointForm({
  organizationId, eventId, window,
}: { organizationId: string; eventId: string; window: EventWindow }) {
  const [state, action, pending] = useActionState(createCheckpoint, initial);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state]);
  return (
    <form ref={formRef} action={action} aria-label="Create checkpoint" className="space-y-4">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="event_id" value={eventId} />
      <CheckpointFields window={window} />
      <Feedback state={state} />
      <Button type="submit" isLoading={pending}>Create checkpoint</Button>
    </form>
  );
}

export function EditCheckpointForm({
  organizationId, eventId, checkpoint, window,
}: { organizationId: string; eventId: string; checkpoint: Checkpoint; window: EventWindow }) {
  const [state, action, pending] = useActionState(updateCheckpoint, initial);
  return (
    <form action={action} aria-label={`Edit checkpoint ${checkpoint.label}`} className="space-y-4">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="checkpoint_id" value={checkpoint.id} />
      <CheckpointFields checkpoint={checkpoint} window={window} />
      <Feedback state={state} />
      <Button type="submit" size="sm" isLoading={pending}>Save checkpoint</Button>
    </form>
  );
}

export function DeleteCheckpointForm({
  organizationId, eventId, checkpoint,
}: { organizationId: string; eventId: string; checkpoint: Checkpoint }) {
  const [state, action, pending] = useActionState(deleteCheckpoint, initial);
  return (
    <form action={action} aria-label={`Delete checkpoint ${checkpoint.label}`} className="space-y-3">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="checkpoint_id" value={checkpoint.id} />
      <label className="flex items-start gap-2 text-sm">
        <input name="confirm_delete" type="checkbox" value="yes" required className="mt-1 accent-rose-600" />
        I confirm deleting this checkpoint. This cannot be undone.
      </label>
      <Feedback state={state} />
      <Button type="submit" variant="danger" size="sm" isLoading={pending}>Delete checkpoint</Button>
    </form>
  );
}
