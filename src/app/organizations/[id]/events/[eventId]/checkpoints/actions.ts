"use server";

import { revalidatePath } from "next/cache";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "../../validation";
import { validateCheckpoint } from "./validation";

export type CheckpointActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function checkpointPath(organizationId: string, eventId: string) {
  return `/organizations/${organizationId}/events/${eventId}/checkpoints`;
}

async function getEditableEvent(organizationId: string, eventId: string) {
  const auth = await getAuthState();
  if (auth.status !== "authenticated") {
    return { client: null, event: null, message: "Your HNU session is not authorized. Sign in again." };
  }
  const client = await createClient();
  const [manager, found] = await Promise.all([
    client.rpc("can_manage_org", { org_id: organizationId }),
    client.from("events").select("starts_at,ends_at,state,roster_frozen_at")
      .eq("organization_id", organizationId).eq("id", eventId).maybeSingle(),
  ]);
  if (manager.error) {
    return { client: null, event: null, message: "Could not verify event-management permissions. Try again." };
  }
  if (manager.data !== true) {
    return { client: null, event: null, message: "You are not authorized to manage this organization's checkpoints." };
  }
  if (found.error) {
    return { client: null, event: null, message: "Could not verify the event. Try again." };
  }
  if (!found.data) {
    return { client: null, event: null, message: "Event was not found in this organization." };
  }
  if (found.data.state !== "DRAFT" || found.data.roster_frozen_at !== null) {
    return { client: null, event: null, message: "Checkpoints can only be changed on unfrozen DRAFT events." };
  }
  return { client, event: found.data, message: "" };
}

function errorMessage(code: string | undefined, operation: "create" | "update" | "delete") {
  if (code === "23505") return "A checkpoint with that label already exists in this event.";
  if (code === "22023") return "The checkpoint window must remain inside the event schedule.";
  if (code === "42501") return "This event is no longer editable, or you lack permission.";
  if (code === "23514") return "The Backend rejected the checkpoint details.";
  if (code === "23503") return "The parent event no longer exists.";
  return `Could not ${operation} the checkpoint. Try again.`;
}

export async function createCheckpoint(
  _previous: CheckpointActionState, form: FormData,
): Promise<CheckpointActionState> {
  const organizationId = form.get("organization_id");
  const eventId = form.get("event_id");
  if (!isUuid(organizationId) || !isUuid(eventId)) {
    return { status: "error", message: "Invalid organization or event ID." };
  }

  try {
    const authorized = await getEditableEvent(organizationId, eventId);
    if (!authorized.client || !authorized.event) return { status: "error", message: authorized.message };
    const parsed = validateCheckpoint(form, authorized.event);
    if (!parsed.input) return { status: "error", message: parsed.message };

    // RLS and the event-locking trigger independently enforce scope, DRAFT and freeze guards.
    const { data, error } = await authorized.client.from("event_checkpoints")
      .insert({ event_id: eventId, ...parsed.input }).select("id").single();
    if (error || !data) {
      return { status: "error", message: errorMessage(error?.code, "create") };
    }
    revalidatePath(checkpointPath(organizationId, eventId));
    return { status: "success", message: "Checkpoint created successfully." };
  } catch {
    return { status: "error", message: "Could not create the checkpoint. Try again." };
  }
}

export async function updateCheckpoint(
  _previous: CheckpointActionState, form: FormData,
): Promise<CheckpointActionState> {
  const organizationId = form.get("organization_id");
  const eventId = form.get("event_id");
  const checkpointId = form.get("checkpoint_id");
  if (!isUuid(organizationId) || !isUuid(eventId) || !isUuid(checkpointId)) {
    return { status: "error", message: "Invalid organization, event, or checkpoint ID." };
  }

  try {
    const authorized = await getEditableEvent(organizationId, eventId);
    if (!authorized.client || !authorized.event) return { status: "error", message: authorized.message };
    const parsed = validateCheckpoint(form, authorized.event);
    if (!parsed.input) return { status: "error", message: parsed.message };

    // Only approved mutable fields; cannot move a checkpoint between events.
    const { data, error } = await authorized.client.from("event_checkpoints")
      .update(parsed.input).eq("event_id", eventId).eq("id", checkpointId)
      .select("id").maybeSingle();
    if (error) return { status: "error", message: errorMessage(error.code, "update") };
    if (!data) return { status: "error", message: "Checkpoint was not found or cannot be updated." };

    revalidatePath(checkpointPath(organizationId, eventId));
    return { status: "success", message: "Checkpoint updated successfully." };
  } catch {
    return { status: "error", message: "Could not update the checkpoint. Try again." };
  }
}

export async function deleteCheckpoint(
  _previous: CheckpointActionState, form: FormData,
): Promise<CheckpointActionState> {
  const organizationId = form.get("organization_id");
  const eventId = form.get("event_id");
  const checkpointId = form.get("checkpoint_id");
  if (!isUuid(organizationId) || !isUuid(eventId) || !isUuid(checkpointId)) {
    return { status: "error", message: "Invalid organization, event, or checkpoint ID." };
  }
  if (form.get("confirm_delete") !== "yes") {
    return { status: "error", message: "Confirm deletion before removing the checkpoint." };
  }

  try {
    const authorized = await getEditableEvent(organizationId, eventId);
    if (!authorized.client || !authorized.event) return { status: "error", message: authorized.message };

    const { data, error } = await authorized.client.from("event_checkpoints")
      .delete().eq("event_id", eventId).eq("id", checkpointId)
      .select("id").maybeSingle();
    if (error) return { status: "error", message: errorMessage(error.code, "delete") };
    if (!data) return { status: "error", message: "Checkpoint was not found or cannot be deleted." };

    revalidatePath(checkpointPath(organizationId, eventId));
    return { status: "success", message: "Checkpoint deleted successfully." };
  } catch {
    return { status: "error", message: "Could not delete the checkpoint. Try again." };
  }
}
