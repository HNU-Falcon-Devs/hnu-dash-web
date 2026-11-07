"use server";

import { revalidatePath } from "next/cache";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid, validateDraftEvent } from "./validation";

export type EventActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

async function authorizedManager(organizationId: string) {
  const auth = await getAuthState();
  if (auth.status !== "authenticated") {
    return { client: null, message: "Your HNU session is not authorized. Sign in again." };
  }
  const client = await createClient();
  // Authoritative Backend predicate: platform admin OR verified active org leader.
  const { data, error } = await client.rpc("can_manage_org", { org_id: organizationId });
  if (error) return { client: null, message: "Could not verify event-management permissions. Try again." };
  if (data !== true) return { client: null, message: "You are not authorized to manage this organization's events." };
  return { client, message: "" };
}

export async function createDraftEvent(
  _previous: EventActionState, formData: FormData,
): Promise<EventActionState> {
  const organizationId = formData.get("organization_id");
  if (!isUuid(organizationId)) return { status: "error", message: "Invalid organization ID." };
  const parsed = validateDraftEvent(formData);
  if (!parsed.input) return { status: "error", message: parsed.message };

  try {
    const auth = await authorizedManager(organizationId);
    if (!auth.client) return { status: "error", message: auth.message };

    // RLS enforces can_manage_org and defaults state to DRAFT, created_by to auth.uid().
    const { data, error } = await auth.client.from("events").insert({
      organization_id: organizationId,
      title: parsed.input.title,
      starts_at: parsed.input.startsAt,
      ends_at: parsed.input.endsAt,
      target_year_levels: parsed.input.yearLevels,
    }).select("id").single();

    if (error?.code === "23503") return { status: "error", message: "Organization was not found." };
    if (error?.code === "23514") return { status: "error", message: "Event details were rejected by the Backend." };
    if (error || !data) return { status: "error", message: "Could not create the draft event. Try again." };

    revalidatePath(`/organizations/${organizationId}/events`);
    return { status: "success", message: "Draft event created successfully." };
  } catch {
    return { status: "error", message: "Could not create the draft event. Try again." };
  }
}

export async function updateDraftEvent(
  _previous: EventActionState, formData: FormData,
): Promise<EventActionState> {
  const organizationId = formData.get("organization_id");
  const eventId = formData.get("event_id");
  if (!isUuid(organizationId) || !isUuid(eventId)) {
    return { status: "error", message: "Invalid organization or event ID." };
  }
  const parsed = validateDraftEvent(formData);
  if (!parsed.input) return { status: "error", message: parsed.message };

  try {
    const auth = await authorizedManager(organizationId);
    if (!auth.client) return { status: "error", message: auth.message };

    // Prevent an event ID from another organization being edited via altered form fields.
    const { data: current, error: readError } = await auth.client.from("events")
      .select("id,state,roster_frozen_at").eq("organization_id", organizationId)
      .eq("id", eventId).maybeSingle();
    if (readError) return { status: "error", message: "Could not verify the draft event. Try again." };
    if (!current) return { status: "error", message: "Event was not found in this organization." };
    if (current.state !== "DRAFT" || current.roster_frozen_at !== null) {
      return { status: "error", message: "Only unfrozen draft events can be edited." };
    }

    // Backend RPC locks the row and rechecks scope, DRAFT status, frozen roster and checkpoints.
    const { error } = await auth.client.rpc("update_draft_event", {
      eid: eventId,
      new_title: parsed.input.title,
      new_starts_at: parsed.input.startsAt,
      new_ends_at: parsed.input.endsAt,
      new_target_year_levels: parsed.input.yearLevels,
    });
    if (error?.code === "42501") {
      return { status: "error", message: "This event is no longer an editable draft or you lack permission." };
    }
    if (error?.code === "22023") {
      return { status: "error", message: "The schedule would exclude an existing checkpoint." };
    }
    if (error?.code === "23514") {
      return { status: "error", message: "Event details were rejected by the Backend." };
    }
    if (error) return { status: "error", message: "Could not update the draft event. Try again." };

    revalidatePath(`/organizations/${organizationId}/events`);
    return { status: "success", message: "Draft event updated successfully." };
  } catch {
    return { status: "error", message: "Could not update the draft event. Try again." };
  }
}
