"use server";

import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  assignmentOutcome, parsePreparation, updateOutcome, validAssignment, validIntent, validUpdate,
  type AssignmentInput, type Intent, type UpdateInput, type PrepareResult,
  type Outcome, type AssignmentStatus, type UpdateStatus,
} from "./membership-contract";

async function authorizedAdminClient() {
  const identity = await getAuthState();
  if (identity.status !== "authenticated") return null;
  const client = await createClient();
  const { data, error } = await client.rpc("is_platform_admin");
  return !error && data === true ? client : null;
}

export async function prepareMembership(input: AssignmentInput): Promise<PrepareResult> {
  if (!validAssignment(input)) return { status: "invalid_input" };
  try {
    const client = await authorizedAdminClient();
    if (!client) return { status: "unavailable" };
    const { data, error } = await client.rpc("prepare_org_member_assignment", {
      p_organization_id: input.organizationId, p_email: input.email, p_role: input.role,
    });
    return error ? { status: "unavailable" } : parsePreparation(data, input);
  } catch { return { status: "unavailable" }; }
}

export async function assignMembership(intent: Intent): Promise<Outcome<AssignmentStatus>> {
  // A malformed/denied response cannot reconcile a previously lost outcome.
  if (!validIntent(intent)) return { status: "unknown" };
  try {
    const client = await authorizedAdminClient();
    if (!client) return { status: "unknown" };
    const { data, error } = await client.rpc("assign_verified_org_member", {
      p_organization_id: intent.organizationId, p_email: intent.email, p_role: intent.role,
      p_request_id: intent.requestId, p_intent_token: intent.token,
    });
    return error ? { status: "unknown" } : assignmentOutcome(data, intent);
  } catch { return { status: "unknown" }; }
}

export async function updateMembership(input: UpdateInput): Promise<Outcome<UpdateStatus>> {
  if (!validUpdate(input)) return { status: "unknown" };
  try {
    const client = await authorizedAdminClient();
    if (!client) return { status: "unknown" };
    const { data, error } = await client.rpc("update_org_member", {
      p_organization_id: input.organizationId, p_user_id: input.userId,
      p_role: input.role, p_active: input.active, p_expected_revision: input.revision,
    });
    return error ? { status: "unknown" } : updateOutcome(data, input);
  } catch { return { status: "unknown" }; }
}
