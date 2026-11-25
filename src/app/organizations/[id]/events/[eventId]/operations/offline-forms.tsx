"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { finalizeEvent, reconcileOffline, type OperationState } from "./actions";
import { LOSS_TYPES, reason, type OfflineKind } from "./offline-contract";

const initial: OperationState = { status: "idle", message: "" };
const copy = {
  enable: ["Enable offline attendance", "I understand this DRAFT opt-in is irreversible. Upload cutoff is 24 hours after the final frozen checkpoint closes."],
  seal: ["Seal offline uploads", "I confirm permanently closing new offline uploads. Missing evidence must be accounted for explicitly."],
  loss: ["Record session loss", "I confirm this irreversible loss disposition; it is not successful synchronization or evidence of attendance."],
  review: ["Review offline claim", "I confirm this individual irreversible decision. Approval cannot create a second accepted attendance slot."],
  confirm: ["Confirm offline reconciliation", "I acknowledge all known preparations and claims, including recorded losses. Loss does not mean synchronization succeeded."],
  finalize: ["Finalize offline attendance", "I reviewed the authoritative evidence and confirm permanent prototype finalization. No reopening or recalculation."],
} as const;

export function OfflineForm({ organizationId, eventId, kind, targetId, eligible, preparationPage = 1, claimPage = 1 }:
  { organizationId: string; eventId: string; kind: OfflineKind | "finalize"; targetId?: string; eligible?: boolean;
    preparationPage?: number; claimPage?: number }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [reasonText, setReason] = useState("");
  const [choice, setChoice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reloaded, setReloaded] = useState(false);
  const [state, action, pending] = useActionState(async (previous: OperationState, form: FormData) => {
    setReloaded(false);
    setConfirmed(false);
    try {
      return await (kind === "finalize" ? finalizeEvent : reconcileOffline)(previous, form);
    } catch {
      return { status: "error", message: "Submission unconfirmed. Reload authoritative evidence before retrying.", reloadRequired: true } satisfies OperationState;
    }
  }, initial);
  const needsReason = kind === "loss" || kind === "review";
  const requiresReload = state.status === "success" || (state.reloadRequired && !reloaded);
  const busy = pending || refreshing;
  const [label, warning] = copy[kind];
  const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950";
  return (
    <form action={action} aria-label={targetId ? label + " " + targetId : label} aria-busy={busy} className="space-y-3">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="operation" value={kind} />
      <input type="hidden" name="target_id" value={targetId ?? ""} />
      <input type="hidden" name="preparations_page" value={preparationPage} />
      <input type="hidden" name="claims_page" value={claimPage} />
      {kind === "finalize" && <input type="hidden" name="confirm_finalize" value="yes" />}
      <fieldset disabled={busy || Boolean(requiresReload)} className="space-y-3">
        {needsReason && <>
          <label className="block"> {kind === "loss" ? "Loss category" : "Individual decision"}
            <select className={fieldClass} name="choice" required value={choice}
              onChange={e => { setChoice(e.target.value); setConfirmed(false); }}>
              <option value="">Choose explicitly</option>
              {kind === "loss" ? LOSS_TYPES.map(type => <option key={type} value={type}>{type}</option>)
                : <><option value="approve" disabled={!eligible}>Approve</option><option value="reject">Reject</option></>}
            </select>
          </label>
          <label className="block">Reason (1–500 characters)
            <textarea className={fieldClass} name="reason" required value={reasonText}
              onChange={e => { setReason(e.target.value); setConfirmed(false); }} rows={3} />
          </label>
        </>}
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1 accent-rose-600"
            name={kind === "finalize" ? "confirm_offline_finalize" : "confirmed"}
            value="yes" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
          {warning}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="danger" isLoading={pending}
            disabled={busy || !confirmed || (needsReason && (!choice || !reason(reasonText) || (kind === "review" && choice === "approve" && !eligible)))}>
            {pending ? "Submitting…" : label}
          </Button>
          <Button type="button" variant="outline" disabled={busy}
            onClick={() => { setConfirmed(false); setChoice(""); setReason(""); }}>Cancel confirmation</Button>
        </div>
      </fieldset>
      {busy && <p role="status">Waiting for Backend confirmation…</p>}
      {state.message && <p role={state.status === "success" ? "status" : "alert"} aria-live="polite">{state.message}</p>}
      {requiresReload && <Button type="button" variant="outline" disabled={busy}
        onClick={() => startRefresh(() => { router.refresh(); setReloaded(true); })}>Reload authoritative evidence</Button>}
      {reloaded && state.status === "error" && <p role="status">If this operation is still available, confirm explicitly to retry the same reason and decision. The Backend will recheck current evidence.</p>}
    </form>
  );
}
