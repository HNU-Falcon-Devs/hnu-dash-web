"use server";

import { revalidatePath } from "next/cache";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "../../validation";

export type OperationState = {
  status: "idle" | "success" | "error";
  message: string;
  openedAt?: string;
};

type ManagedEvent = {
  id: string;
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
    .select("id,state,roster_frozen_at,starts_at,ends_at")
    .eq("organization_id", orgId).eq("id", eventId).maybeSingle();
  if (result.error) return { message: "Could not verify the event and its organization. Try again." };
  if (!result.data || result.data.id !== eventId) {
    return { message: "Event not found in this organization or no longer accessible." };
  }
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
