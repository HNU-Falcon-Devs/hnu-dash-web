"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { assignMembership, prepareMembership, updateMembership } from "./actions";
import { normalizedEmail, isRevision, type Role, type AssignmentInput, type Intent, type UpdateInput } from "./membership-contract";

const fieldClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const reconcile = "If an earlier assignment was uncertain or its intent was lost, reconcile it with an authorized operator before confirming a new assignment.";
const messages = {
  account_unavailable: "Account unavailable for assignment or membership change.",
  organization_unavailable: "Organization unavailable for this membership change.",
  invalid_input: "The membership request was invalid.",
  request_mismatch: "The assignment intent could not be verified.",
  request_expired: "The assignment intent has expired.",
  busy: "Membership management is busy. Review and confirm a new request.",
  membership_unavailable: "Membership is no longer available.",
  state_conflict: "Membership changed since you reviewed it. Refresh and review the current values.",
  unchanged: "No membership change was needed.",
  updated: "Backend confirmed the membership update.",
  assigned: "Backend confirmed the membership assignment.",
  already_member: "This account is already a member. Review the existing membership.",
} as const;

function Feedback({ message, success = false }: { message: string; success?: boolean }) {
  return message ? <p role={success ? "status" : "alert"} className={success ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-rose-700 dark:text-rose-400"}>{message}</p> : null;
}

export function AssignMembershipForm({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [review, setReview] = useState<AssignmentInput | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [mode, setMode] = useState<"edit" | "review" | "pending" | "retry" | "reconcile" | "done">("edit");
  const [ack, setAck] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const inFlight = useRef(false);

  function reset() {
    setReview(null); setIntent(null); setAck(false); setUncertain(false); setSuccess(false); setMessage(""); setMode("edit");
  }

  async function execute(current: Intent, wasUncertain: boolean) {
    // Retain the exact immutable payload before any assignment dispatch.
    setIntent(current);
    const result = await assignMembership(current).catch(() => ({ status: "unknown" as const }));
    if (result.status === "unknown") {
      setUncertain(true); setMode("retry");
      setMessage("Assignment outcome unknown. Retry only this exact intent, or reconcile with an authorized operator.");
      return;
    }
    if (result.status === "rate_limited") {
      setMode("retry");
      setMessage("Rate limited. Wait at least " + result.retryAfter + " seconds before retrying this exact intent.");
      return;
    }
    if (result.status === "request_expired" || result.status === "request_mismatch" || (wasUncertain && !result.replayed && result.status !== "assigned" && result.status !== "already_member")) {
      setMode("reconcile"); setAck(false);
      setMessage(messages[result.status] + " " + reconcile);
      return;
    }
    setIntent(null); setMode("done");
    setSuccess(result.status === "assigned");
    setMessage(messages[result.status] + (result.replayed ? " Historical receipt only; check the refreshed membership list for current access." : ""));
    router.refresh();
  }

  async function confirm() {
    if (inFlight.current || !review || !ack || mode !== "review") return;
    inFlight.current = true; setMode("pending"); setMessage(""); setSuccess(false);
    try {
      const prepared = await prepareMembership(review).catch(() => ({ status: "unavailable" as const }));
      if (prepared.status !== "intent_issued") {
        setMode("done");
        setMessage(prepared.status === "unavailable" ? "Could not prepare assignment. No assignment was sent. Review and confirm again." : messages[prepared.status]);
        return;
      }
      await execute(prepared.intent, false);
    } finally { inFlight.current = false; }
  }

  async function retry() {
    if (!intent || mode !== "retry" || inFlight.current) return;
    // Local time is only a conservative UI guard; the Backend is authoritative.
    const deadline = Date.parse(uncertain ? intent.replayBefore : intent.executeBefore);
    if (Date.now() >= deadline) {
      setMode("reconcile"); setAck(false); setMessage("The intent window may have expired. " + reconcile); return;
    }
    inFlight.current = true; setMode("pending");
    try { await execute(intent, uncertain); } finally { inFlight.current = false; }
  }

  return (
    <form aria-label="Assign organization member" className="space-y-4" onSubmit={event => {
      event.preventDefault();
      if (mode !== "edit" || inFlight.current) return;
      const normalized = normalizedEmail(email);
      if (!normalized) { setMessage("Enter an exact HNU email address."); return; }
      setReview({ organizationId, email: normalized, role }); setAck(false); setMessage(""); setMode("review");
    }}>
      <fieldset disabled={mode !== "edit"} className="space-y-4">
        <div>
          <label htmlFor="member-email" className="mb-1.5 block text-sm font-medium">HNU email address</label>
          <input id="member-email" name="email" type="text" inputMode="email" required spellCheck={false} autoComplete="off" maxLength={254}
            value={email} onChange={event => setEmail(event.target.value)} aria-describedby="member-email-help" className={fieldClass} />
          <p id="member-email-help" className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Enter the exact HNU account email. The Backend verifies eligibility; no account directory is available.</p>
        </div>
        <div>
          <label htmlFor="assign-role" className="mb-1.5 block text-sm font-medium">Role</label>
          <select id="assign-role" name="role" className={fieldClass} value={role} onChange={event => setRole(event.target.value as Role)}>
            <option value="staff">Staff</option><option value="leader">Leader</option>
          </select>
        </div>
      </fieldset>
      {mode === "edit" && <><p className="text-xs text-slate-500 dark:text-slate-400">{reconcile}</p><Button type="submit">Review assignment</Button></>}
      {mode === "review" && review && <div className="space-y-3 rounded-lg border p-3" aria-label="Confirm assignment details">
        <p className="text-sm break-all">Assign {review.email} as {review.role} in {organizationName} ({review.organizationId}).</p>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)} />I confirm these details and have reconciled any earlier uncertain assignment.</label>
        <Button type="button" disabled={!ack} onClick={confirm}>Confirm assignment</Button>{" "}
        <Button type="button" variant="outline" onClick={reset}>Edit details</Button>
      </div>}
      {mode === "pending" && <p role="status">Submitting confirmed assignment…</p>}
      {mode === "retry" && intent && <div className="space-y-2">
        <p className="text-xs break-all">Original intent: {intent.email}, {intent.role}. Execute before {intent.executeBefore}; replay before {intent.replayBefore} (UTC).</p>
        <Button type="button" onClick={retry}>Retry exact intent</Button>{" "}
        <Button type="button" variant="outline" onClick={() => { setMode("reconcile"); setAck(false); setMessage(reconcile); }}>Manual reconciliation</Button>
      </div>}
      {mode === "reconcile" && <div className="space-y-2">
        <p className="text-sm">{reconcile}</p>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)} />An authorized operator has reconciled the earlier assignment.</label>
        <Button type="button" disabled={!ack} onClick={() => { router.refresh(); reset(); }}>Start a new review</Button>
      </div>}
      {mode === "done" && <Button type="button" variant="outline" onClick={reset}>Review another assignment</Button>}
      <Feedback message={message} success={success} />
    </form>
  );
}

export function MembershipEditor({ organizationId, userId, role, active, revision }: { organizationId: string; userId: string; role: Role; active: boolean; revision: string }) {
  const router = useRouter();
  const [choice, setChoice] = useState<{ role: Role; active: boolean; revision: string } | null>(null);
  const [review, setReview] = useState<UpdateInput | null>(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const inFlight = useRef(false);
  const current = choice?.revision === revision ? choice : { role, active, revision };
  async function confirm() {
    if (inFlight.current || !review || review.revision !== revision || needsRefresh) return;
    inFlight.current = true; setPending(true); setMessage(""); setSuccess(false);
    try {
      const result = await updateMembership(review).catch(() => ({ status: "unknown" as const }));
      setReview(null); setChoice(null);
      if (result.status === "unknown" || result.status === "state_conflict") {
        setNeedsRefresh(true);
        setMessage(result.status === "unknown" ? "Update outcome unknown. Refresh and reconcile current membership before confirming another change." : messages.state_conflict);
        router.refresh(); return;
      }
      setSuccess(result.status === "updated" || result.status === "unchanged");
      setMessage(result.status === "rate_limited" ? "Rate limited. Wait at least " + result.retryAfter + " seconds, then review and confirm again." : messages[result.status]);
      // Never infer a new revision from an update response. Use a fresh read.
      setNeedsRefresh(true); router.refresh();
    } finally { inFlight.current = false; setPending(false); }
  }
  return (
    <form aria-label={`Edit membership ${userId}`} className="flex flex-wrap items-end gap-3" onSubmit={event => {
      event.preventDefault();
      if (pending || inFlight.current || needsRefresh || refreshing || review || !isRevision(revision)) return;
      setReview({ organizationId, userId, role: current.role, active: current.active, revision }); setMessage(""); setSuccess(false);
    }}>
      <fieldset disabled={pending || !!review || needsRefresh || refreshing} className="flex flex-wrap items-end gap-3 flex-1">
        <div className="min-w-28 flex-1">
          <label htmlFor={`role-${userId}`} className="mb-1 block text-xs font-medium">Role</label>
          <select id={`role-${userId}`} name="role" value={current.role} onChange={event => setChoice({ ...current, role: event.target.value as Role })} className={fieldClass}>
            <option value="staff">Staff</option><option value="leader">Leader</option>
          </select>
        </div>
        <div className="min-w-28 flex-1">
          <label htmlFor={`active-${userId}`} className="mb-1 block text-xs font-medium">Status</label>
          <select id={`active-${userId}`} name="active" value={String(current.active)} onChange={event => setChoice({ ...current, active: event.target.value === "true" })} className={fieldClass}>
            <option value="true">Active</option><option value="false">Inactive</option>
          </select>
        </div>
        <Button type="submit" size="sm">Review changes</Button>
      </fieldset>
      {review && <div className="w-full space-y-2 text-sm">
        <p>Confirm {review.role}, {review.active ? "active" : "inactive"} for {userId}, revision {review.revision}.</p>
        {review.revision !== revision && <p role="alert">Membership changed. Cancel and review the current values.</p>}
        <Button type="button" size="sm" isLoading={pending} disabled={review.revision !== revision} onClick={confirm}>Confirm changes</Button>{" "}
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => { setReview(null); setChoice(null); }}>Cancel</Button>
      </div>}
      {needsRefresh && <div className="w-full space-y-2"><p className="text-xs">Review the refreshed membership before making another change. If the outcome is uncertain, reconcile with an authorized operator.</p>
        <Button type="button" size="sm" isLoading={refreshing} onClick={() => { startRefresh(() => { router.refresh(); setChoice(null); setNeedsRefresh(false); }); }}>Review current membership</Button>
      </div>}
      <Feedback message={message} success={success} />
    </form>
  );
}
