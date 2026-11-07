"use server";

import { revalidatePath } from "next/cache";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMembershipRole, isUuid } from "./validation";

export type MembershipActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

async function authorizedAdminClient() {
  const identity = await getAuthState();
  if (identity.status !== "authenticated") {
    return { client: null, message: "Your session is not authorized. Sign in again." };
  }

  const client = await createClient();
  const { data, error } = await client.rpc("is_platform_admin");
  if (error) return { client: null, message: "Could not verify administrator permissions. Try again." };
  if (data !== true) return { client: null, message: "Only platform administrators can manage memberships." };
  return { client, message: "" };
}

export async function assignMembership(
  _previous: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  const organizationId = formData.get("organization_id");
  const userIdInput = formData.get("user_id");
  const role = formData.get("role");
  const userId = typeof userIdInput === "string" ? userIdInput.trim() : "";

  if (!isUuid(organizationId) || !isUuid(userId)) {
    return { status: "error", message: "Enter valid organization and user UUIDs." };
  }
  if (!isMembershipRole(role)) {
    return { status: "error", message: "Choose either leader or staff." };
  }

  try {
    const auth = await authorizedAdminClient();
    if (!auth.client) return { status: "error", message: auth.message };

    // Backend populates active/granted_by. A UUID does not prove HNU verification.
    const { error } = await auth.client.from("organization_memberships").insert({
      organization_id: organizationId,
      user_id: userId,
      role,
    });

    if (error?.code === "23505") {
      return { status: "error", message: "This user is already a member. Edit the existing membership." };
    }
    if (error?.code === "23503") {
      return { status: "error", message: "The Auth user or organization was not found. Verify the supplied UUIDs." };
    }
    if (error) return { status: "error", message: "Could not assign membership. Try again." };

    revalidatePath(`/organizations/${organizationId}`);
    return { status: "success", message: "Membership assigned successfully." };
  } catch {
    return { status: "error", message: "Could not assign membership. Try again." };
  }
}

export async function updateMembership(
  _previous: MembershipActionState,
  formData: FormData,
): Promise<MembershipActionState> {
  const organizationId = formData.get("organization_id");
  const userId = formData.get("user_id");
  const role = formData.get("role");
  const activeInput = formData.get("active");

  if (!isUuid(organizationId) || !isUuid(userId)) {
    return { status: "error", message: "Invalid organization or membership UUID." };
  }
  if (!isMembershipRole(role) || (activeInput !== "true" && activeInput !== "false")) {
    return { status: "error", message: "Choose a valid role and activity status." };
  }

  try {
    const auth = await authorizedAdminClient();
    if (!auth.client) return { status: "error", message: auth.message };

    // Only role/active are writable; both composite PK fields scope the update.
    const { data, error } = await auth.client.from("organization_memberships")
      .update({ role, active: activeInput === "true" })
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .select("user_id")
      .maybeSingle();

    if (error) return { status: "error", message: "Could not update membership. Try again." };
    if (!data) return { status: "error", message: "Membership no longer exists or cannot be updated." };

    revalidatePath(`/organizations/${organizationId}`);
    return { status: "success", message: "Membership updated successfully." };
  } catch {
    return { status: "error", message: "Could not update membership. Try again." };
  }
}
