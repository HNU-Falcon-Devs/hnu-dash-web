"use server";

import { revalidatePath } from "next/cache";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "../../validation";

export type FreezeState = {
  status: "idle" | "error" | "success";
  message: string;
  frozenCount?: number;
};

/** Every submitted form is untrusted, regardless of whether a button was rendered. */
export async function freezeEventRoster(
  _previous: FreezeState, form: FormData,
): Promise<FreezeState> {
  const organizationId = form.get("organization_id");
  const eventId = form.get("event_id");
  if (!isUuid(organizationId) || !isUuid(eventId)) {
    return { status: "error", message: "Invalid organization or event ID." };
  }
  if (form.get("confirm_freeze") !== "yes") {
    return { status: "error", message: "Confirm that you understand the roster freeze is irreversible." };
  }
  try {
    const identity = await getAuthState();
    if (identity.status !== "authenticated") {
      return { status: "error", message: "Your verified HNU session is not authorized. Sign in again." };
    }

    const client = await createClient();
    const [manager, parent] = await Promise.all([
      client.rpc("can_manage_org", { org_id: organizationId }),
      client.from("events").select("id,state,roster_frozen_at")
        .eq("organization_id", organizationId).eq("id", eventId).maybeSingle(),
    ]);
    if (manager.error) {
      return { status: "error", message: "Could not verify roster-management permissions. Try again." };
    }
    if (manager.data !== true) {
      return { status: "error", message: "Only authorized organization leaders and platform administrators can freeze a roster." };
    }
    if (parent.error) return { status: "error", message: "Could not verify the event. Try again." };
    if (!parent.data) return { status: "error", message: "Event was not found in this organization." };
    if (parent.data.roster_frozen_at !== null) {
      return { status: "error", message: "This event roster is already frozen." };
    }
    if (parent.data.state !== "DRAFT") {
      return { status: "error", message: "Only unfrozen DRAFT event rosters can be frozen." };
    }

    const checkpoints = await client.from("event_checkpoints")
      .select("id", { count: "exact", head: true }).eq("event_id", eventId);
    if (checkpoints.error || checkpoints.count === null) {
      return { status: "error", message: "Could not verify checkpoints. Try again." };
    }
    if (checkpoints.count < 1) {
      return { status: "error", message: "Configure at least one checkpoint before freezing." };
    }

    // The Backend locks the event, rechecks manager rights, DRAFT/frozen status,
    // checkpoint windows and eligible active BSIT rows, and creates the snapshot atomically.
    const { data, error } = await client.rpc("freeze_event_roster", { eid: eventId });
    if (error?.code === "42501") {
      return { status: "error", message: "This event is no longer editable or you lack permission." };
    }
    if (error?.code === "22023") {
      return { status: "error", message: "The Backend could not freeze this roster: no eligible active BSIT students, missing checkpoints, or invalid checkpoint windows." };
    }
    if (error) {
      return { status: "error", message: "The Backend did not confirm a roster freeze. Check the current event status before retrying." };
    }
    if (typeof data !== "number" || !Number.isInteger(data) || data < 1) {
      return { status: "error", message: "Unexpected Backend freeze result. Check roster status before attempting another freeze." };
    }

    revalidatePath(`/organizations/${organizationId}/events/${eventId}/roster`);
    revalidatePath(`/organizations/${organizationId}/events/${eventId}/checkpoints`);
    revalidatePath(`/organizations/${organizationId}/events`);
    return { status: "success", message: `Backend confirmed ${data} frozen student records.`, frozenCount: data };
  } catch {
    return { status: "error", message: "Unable to confirm the roster freeze. Reload the event before retrying." };
  }
}
