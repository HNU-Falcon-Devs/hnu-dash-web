"use server";

import { revalidatePath } from "next/cache";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "../../validation";
import { decision, loss, reason, validPolicy, validAcknowledgement, type OfflineKind, type EventPolicy } from "./offline-contract";
import { readOfflineEvidence, readOfflineSummary } from "./offline-data";

export type OperationState = {
  status: "idle" | "success" | "error";
  message: string;
  openedAt?: string;
  reloadRequired?: boolean;
};

type ManagedEvent = EventPolicy & {
  id: string;
  organization_id: string;
  state: string;
  roster_frozen_at: string | null;
  starts_at: string;
  ends_at: string;
};

type ManagedContext =
  | { client: Awaited<ReturnType<typeof createClient>>; event: ManagedEvent; message?: never }
  | { client?: never; event?: never; message: string };

const failed = (message: string): OperationState => ({ status: "error", message });

function backendError(code: string | undefined, operation: "assign" | "revoke" | "open"): string {
  if (["PGRST202", "PGRST205", "42883", "42P01", "42703"].includes(code ?? "")) {
    return "This Backend operation is not available yet. The approved Milestone 2 migration may not be deployed.";
  }
  if (code === "42501" || code === "PGRST301") {
    return "Your permissions may have changed. Sign in again or ask an authorized event manager.";
  }
  if (operation === "assign") {
    if (code === "23505") return "This Staff member already has an active assignment for this event.";
    if (code === "22023") return "The selected account is not eligible active, verified organization Staff.";
    if (code === "55000") return "Assignments are unavailable in this event state.";
  }
  if (operation === "revoke" && code === "55000") {
    return "That assignment has already been revoked. Reload the event.";
  }
  if (operation === "open") {
    if (code === "55000") return "This event is no longer a DRAFT. Reload to see its current state.";
    if (code === "22023") return "The Backend rejected event readiness. Check the frozen roster, schedule, and checkpoints.";
  }
  return "The Backend did not confirm this change. Reload before retrying.";
}

async function authorizedEvent(orgId: string, eventId: string): Promise<ManagedContext> {
  const auth = await getAuthState();
  if (auth.status !== "authenticated") {
    return { message: "A verified HNU session is required. Sign in again." };
  }
  const client = await createClient();
  const manager = await client.rpc("can_manage_org", { org_id: orgId });
  if (manager.error || manager.data !== true) {
    return { message: manager.error
      ? "Could not verify event-management permissions. Try again."
      : "You are not authorized to manage this organization's events." };
  }
  const result = await client.from("events")
    .select("id,organization_id,state,roster_frozen_at,starts_at,ends_at,offline_enabled,offline_upload_cutoff")
    .eq("organization_id", orgId).eq("id", eventId).maybeSingle();
  if (result.error) return { message: "Could not verify the event and its organization. Try again." };
  if (!result.data || result.data.id !== eventId || result.data.organization_id !== orgId) {
    return { message: "Event not found in this organization or no longer accessible." };
  }
  if (!validPolicy(result.data)) return { message: "Could not verify the event offline policy. Reload before continuing." };
  return { client, event: result.data as ManagedEvent };
}

function refresh(orgId: string, eventId: string) {
  revalidatePath("/organizations/" + orgId + "/events");
  revalidatePath("/organizations/" + orgId + "/events/" + eventId + "/operations");
  revalidatePath("/organizations/" + orgId + "/events/" + eventId + "/checkpoints");
  revalidatePath("/organizations/" + orgId + "/events/" + eventId + "/roster");
}

export async function assignEventStaff(
  _previous: OperationState, form: FormData,
): Promise<OperationState> {
  const orgId = form.get("organization_id");
  const eventId = form.get("event_id");
  const staffId = form.get("staff_user_id");
  if (!isUuid(orgId) || !isUuid(eventId) || !isUuid(staffId)) {
    return failed("Invalid organization, event, or Staff account identifier.");
  }

  try {
    const context = await authorizedEvent(orgId, eventId);
    if (!context.client) return failed(context.message);
    if (!["DRAFT", "OPEN"].includes(context.event.state)) {
      return failed("This event does not allow Staff assignment in its current state.");
    }

    // Membership visibility is scoped by Backend RLS; the RPC independently
    // validates HNU verification, active Staff membership, and event scope.
    const candidate = await context.client.from("organization_memberships")
      .select("user_id").eq("organization_id", orgId).eq("user_id", staffId)
      .eq("role", "staff").eq("active", true).maybeSingle();
    if (candidate.error) return failed("Could not verify Staff eligibility. Try again.");
    if (!candidate.data) return failed("Choose an active Staff member of this organization.");

    const { data, error } = await context.client.rpc("assign_event_staff", {
      eid: eventId, staff_uid: staffId,
    });
    if (error) return failed(backendError(error.code, "assign"));
    if (!isUuid(data)) {
      return failed("Unexpected assignment response. Reload before retrying.");
    }
    refresh(orgId, eventId);
    return { status: "success", message: "Backend confirmed the Staff assignment." };
  } catch {
    return failed("Could not confirm the Staff assignment. Reload before retrying.");
  }
}

export async function revokeEventStaff(
  _previous: OperationState, form: FormData,
): Promise<OperationState> {
  const orgId = form.get("organization_id");
  const eventId = form.get("event_id");
  const assignmentId = form.get("assignment_id");
  if (!isUuid(orgId) || !isUuid(eventId) || !isUuid(assignmentId)) {
    return failed("Invalid organization, event, or assignment identifier.");
  }
  if (form.get("confirm_revoke") !== "yes") {
    return failed("Confirm revocation before removing this Staff assignment.");
  }

  try {
    const context = await authorizedEvent(orgId, eventId);
    if (!context.client) return failed(context.message);

    const row = await context.client.from("event_staff")
      .select("id,revoked_at").eq("event_id", eventId)
      .eq("id", assignmentId).maybeSingle();
    if (row.error) return failed(backendError(row.error.code, "revoke"));
    if (!row.data) return failed("This assignment is not available in the selected event.");
    if (row.data.revoked_at !== null) return failed("This assignment was already revoked.");

    const { data, error } = await context.client.rpc("revoke_event_staff", {
      assignment_id: assignmentId,
    });
    if (error) return failed(backendError(error.code, "revoke"));
    if (typeof data !== "string" || data.toLowerCase() !== assignmentId.toLowerCase()) {
      return failed("Unexpected revocation response. Reload and check assignment status.");
    }
    refresh(orgId, eventId);
    return { status: "success", message: "Backend confirmed the assignment was revoked." };
  } catch {
    return failed("Could not confirm revocation. Reload to check the assignment.");
  }
}

export async function activateEvent(
  _previous: OperationState, form: FormData,
): Promise<OperationState> {
  const orgId = form.get("organization_id");
  const eventId = form.get("event_id");
  if (!isUuid(orgId) || !isUuid(eventId)) {
    return failed("Invalid organization or event identifier.");
  }
  if (form.get("confirm_open") !== "yes") {
    return failed("Confirm event activation before submitting.");
  }

  try {
    const context = await authorizedEvent(orgId, eventId);
    if (!context.client) return failed(context.message);
    if (context.event.state !== "DRAFT") {
      return failed("Only a DRAFT event can be activated. Reload for its current state.");
    }
    if (!context.event.roster_frozen_at) {
      return failed("Freeze this event's roster before activation.");
    }

    const [roster, checkpoints] = await Promise.all([
      context.client.from("event_roster")
        .select("student_id", { count: "exact", head: true }).eq("event_id", eventId),
      context.client.from("event_checkpoints")
        .select("id,opens_at,closes_at").eq("event_id", eventId),
    ]);
    if (roster.error || checkpoints.error || roster.count === null || !Array.isArray(checkpoints.data)) {
      return failed("Could not verify activation readiness. Reload and try again.");
    }
    const start = Date.parse(context.event.starts_at);
    const end = Date.parse(context.event.ends_at);
    const validWindows = Number.isFinite(start) && Number.isFinite(end) && start < end
      && checkpoints.data.length > 0 && checkpoints.data.every(point => {
        const opens = Date.parse(point.opens_at);
        const closes = Date.parse(point.closes_at);
        return Number.isFinite(opens) && Number.isFinite(closes)
          && opens >= start && closes <= end && opens < closes;
      });
    if (roster.count < 1 || !validWindows) {
      return failed("Activation requires a nonempty frozen roster and valid in-schedule checkpoints.");
    }

    // Sole authoritative DRAFT -> OPEN transition, locked and validated by Backend.
    const { data, error } = await context.client.rpc("open_event", { eid: eventId });
    if (error) return failed(backendError(error.code, "open"));
    const result = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (!result || result.event_id !== eventId || result.event_state !== "OPEN"
        || typeof result.opened_at !== "string" ||
        !Number.isFinite(Date.parse(result.opened_at))) {
      return failed("Unexpected activation response. Reload to verify event state.");
    }
    refresh(orgId, eventId);
    return {
      status: "success",
      message: "Backend confirmed this event is OPEN.",
      openedAt: result.opened_at,
    };
  } catch {
    return failed("Could not confirm activation. Reload to verify the event state before retrying.");
  }
}


type LifecycleOperation = "close" | "finalize";

function lifecycleFailure(message: string): OperationState {
  return { status: "error", message, reloadRequired: true };
}

function lifecycleError(code: string | undefined): string {
  if (code === "42501" || code === "PGRST301") {
    return "This operation is unavailable for your account or event. Reload to verify access.";
  }
  if (code === "22023") {
    return "The Backend rejected event readiness. Check the frozen roster and checkpoints, then reload.";
  }
  if (code === "55000") {
    return "The Backend rejected the transition. Check the current event state and whether all checkpoint windows have ended, then reload.";
  }
  if (["PGRST202", "42883"].includes(code ?? "")) {
    return "The attendance finalization capability is unavailable on this Backend. Reload to check event state.";
  }
  return "The Backend did not confirm the transition. Reload to verify event state before trying again.";
}

async function transitionEvent(kind: LifecycleOperation, form: FormData): Promise<OperationState> {
  const orgId = form.get("organization_id");
  const eventId = form.get("event_id");
  if (!isUuid(orgId) || !isUuid(eventId)) return failed("Invalid organization or event identifier.");
  if (form.get("confirm_" + kind) !== "yes") {
    return failed("Explicit confirmation is required before submitting this transition.");
  }

  let dispatched = false;
  try {
    const context = await authorizedEvent(orgId, eventId);
    if (!context.client) return lifecycleFailure(context.message);
    const allowed = kind === "close"
      ? context.event.state === "OPEN"
      : ["SYNCING", "FINALIZED"].includes(context.event.state);
    if (!allowed) {
      refresh(orgId, eventId);
      return lifecycleFailure("This transition is not available in the current event state. Reload to verify.");
    }

    if (kind === "finalize" && context.event.offline_enabled) {
      if (form.get("confirm_offline_finalize") !== "yes" || context.event.state !== "SYNCING") {
        return lifecycleFailure("Offline finalization requires a separate current reconciliation confirmation. Reload event operations.");
      }
      const evidence = await readOfflineEvidence(context.client, context.event, form.get("preparations_page"), form.get("claims_page"));
      if (!evidence?.summary.can_finalize) return lifecycleFailure("The Backend has not confirmed readiness and current offline evidence. Reload before finalizing.");
    } else if (kind === "finalize" && form.has("confirm_offline_finalize")) {
      return lifecycleFailure("The event offline policy changed. Reload before finalizing.");
    }

    // Timing, roster readiness, authorization and persisted results remain
    // Backend-owned. Finalization alone permits a confirmed replay.
    dispatched = true;
    const { data, error } = await context.client.rpc(
      kind === "close" ? "close_event" : "finalize_event", { eid: eventId },
    );
    // Even a rejected or malformed response may follow a committed write.
    // Refresh all affected routes and require an explicit reload before retry.
    refresh(orgId, eventId);
    if (error) return lifecycleFailure(lifecycleError(error.code));

    const result = data && typeof data === "object" && !Array.isArray(data)
      ? data as Record<string, unknown> : null;
    const timestamp = result?.[kind === "close" ? "closed_at" : "finalized_at"];
    const actor = result?.[kind === "close" ? "closed_by" : "finalized_by"];
    if (!result || result.event_id !== eventId
      || result.event_state !== (kind === "close" ? "SYNCING" : "FINALIZED")
      || typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))
      || !isUuid(actor)
      || (kind === "finalize" && (
        typeof result.record_count !== "number" || !Number.isSafeInteger(result.record_count)
        || result.record_count < 1 || typeof result.replayed !== "boolean"
      ))) {
      return lifecycleFailure("Unexpected Backend response. Reload to verify event state before trying again.");
    }

    return {
      status: "success",
      message: kind === "close"
        ? "Backend confirmed closure. New online evidence is closed; review the provisional evidence."
        : result.replayed === true
          ? "Backend confirmed the original finalized results. No recalculation occurred."
          : "Backend confirmed permanent prototype finalization.",
    };
  } catch {
    if (dispatched) refresh(orgId, eventId);
    return lifecycleFailure("Could not confirm the transition. Reload to verify event state before trying again.");
  }
}

export async function closeEvent(_previous: OperationState, form: FormData): Promise<OperationState> {
  return transitionEvent("close", form);
}

export async function finalizeEvent(_previous: OperationState, form: FormData): Promise<OperationState> {
  return transitionEvent("finalize", form);
}


export async function reconcileOffline(_previous: OperationState, form: FormData): Promise<OperationState> {
  const orgId = form.get("organization_id");
  const eventId = form.get("event_id");
  const kind = form.get("operation");
  const target = form.get("target_id");
  const choice = form.get("choice");
  const exactReason = form.get("reason");
  if (!isUuid(orgId) || !isUuid(eventId) || !["enable", "seal", "loss", "review", "confirm"].some(v => v === kind)
    || form.get("confirmed") !== "yes") return failed("Valid scope and explicit confirmation are required.");
  const operation = kind as OfflineKind;
  if ((operation === "loss" || operation === "review")
    && (!isUuid(target) || !reason(exactReason) || !(operation === "loss" ? loss(choice) : decision(choice)))) {
    return failed("Choose one valid decision or loss category and enter a non-whitespace reason of 1–500 characters.");
  }
  let dispatched = false;
  try {
    const context = await authorizedEvent(orgId, eventId);
    if (!context.client) return lifecycleFailure(context.message);
    const { client, event } = context;
    let rpcName: string;
    let args: Record<string, unknown> = { eid: eventId };
    if (operation === "enable") {
      if (event.state !== "DRAFT") return lifecycleFailure("Offline opt-in is only available in DRAFT. Reload event state.");
      rpcName = "enable_event_offline";
    } else {
      if (!event.offline_enabled) return lifecycleFailure("Offline reconciliation is unavailable for this event.");
      if (operation === "seal") {
        const summary = await readOfflineSummary(client, event);
        if (!summary || (!summary.can_seal && summary.sealed_at === null)) {
          return lifecycleFailure("The Backend has not confirmed upload sealing readiness. Reload.");
        }
        rpcName = "seal_offline_uploads";
      } else {
        const evidence = await readOfflineEvidence(client, event, form.get("preparations_page"), form.get("claims_page"));
        if (!evidence || evidence.summary.sealed_at === null) {
          return lifecycleFailure("Sealed uploads and current authoritative evidence are required. Reload.");
        }
        if (operation === "confirm") {
          if (!evidence.summary.can_confirm && evidence.summary.confirmed_at === null) {
            return lifecycleFailure("The Backend has not confirmed reconciliation readiness. Reload.");
          }
          rpcName = "confirm_offline_reconciliation";
        } else if (operation === "loss") {
          const row = evidence.preparations.find(item => item.preparation_id === target);
          if (!row || (row.disposition === null ? event.state !== "SYNCING" :
            row.disposition !== choice || row.reason !== exactReason)) {
            return lifecycleFailure("This preparation is unavailable or already accounted for with different evidence. Reload.");
          }
          rpcName = "account_offline_preparation_loss";
          args = { ...args, p_preparation_id: target, p_disposition: choice, p_reason: exactReason };
        } else {
          const row = evidence.claims.find(item => item.capture_id === target);
          if (!row || (row.decision === null ? event.state !== "SYNCING" || (choice === "approve" && !row.review_eligible)
            : row.decision !== choice || row.reason !== exactReason)) {
            return lifecycleFailure("This claim is unavailable, ineligible for approval, or already reviewed with a different decision. Reload.");
          }
          rpcName = "review_offline_capture";
          args = { ...args, p_capture_id: target, p_decision: choice, p_reason: exactReason };
        }
      }
    }
    dispatched = true;
    const result = await client.rpc(rpcName, args);
    refresh(orgId, eventId);
    if (result.error) {
      return lifecycleFailure(result.error.code === "23505"
        ? "The Backend reports conflicting immutable evidence. Reload the recorded decision before continuing."
        : "The Backend did not confirm this operation. Reload authoritative evidence before an explicit retry.");
    }
    if (!validAcknowledgement(operation, result.data, eventId, typeof target === "string" ? target : null, choice, exactReason)) {
      return lifecycleFailure("Unexpected Backend acknowledgement. Reload authoritative evidence before continuing.");
    }
    return { status: "success", message: "Backend confirmed the operation. Reload to view authoritative evidence.", reloadRequired: true };
  } catch {
    if (dispatched) refresh(orgId, eventId);
    return lifecycleFailure("The operation could not be confirmed. Reload authoritative evidence before an explicit retry.");
  }
}
