import { beforeEach, describe, expect, it, vi } from "vitest";
import { assignMembership, updateMembership, type MembershipActionState } from "./actions";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const idle: MembershipActionState = { status: "idle", message: "" };
const rpc = vi.fn();
const insert = vi.fn();
const updateResult = vi.fn();
const selectUpdated = vi.fn(() => ({ maybeSingle: updateResult }));
const userEq = vi.fn(() => ({ select: selectUpdated }));
const orgEq = vi.fn(() => ({ eq: userEq }));
const update = vi.fn(() => ({ eq: orgEq }));
const from = vi.fn(() => ({ insert, update }));

function fields(role = "staff", userId = USER, organizationId = ORG, active?: string) {
  const values = new FormData();
  values.set("organization_id", organizationId);
  values.set("user_id", userId);
  values.set("role", role);
  if (active !== undefined) values.set("active", active);
  return values;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "admin@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ rpc, from } as unknown as Awaited<ReturnType<typeof createClient>>);
  rpc.mockResolvedValue({ data: true, error: null });
  insert.mockResolvedValue({ error: null });
  updateResult.mockResolvedValue({ data: { user_id: USER }, error: null });
});

describe("assignMembership", () => {
  it("inserts only approved fields and refreshes after successful assignment", async () => {
    const result = await assignMembership(idle, fields("leader"));
    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("is_platform_admin");
    expect(from).toHaveBeenCalledWith("organization_memberships");
    expect(insert).toHaveBeenCalledWith({
      organization_id: ORG, user_id: USER, role: "leader",
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/organizations/${ORG}`);
  });

  it("rejects malformed UUIDs and unapproved roles before any query", async () => {
    expect((await assignMembership(idle, fields("staff", "not-a-uuid"))).status).toBe("error");
    expect((await assignMembership(idle, fields("staff", USER, "bad-org"))).status).toBe("error");
    expect((await assignMembership(idle, fields("platform_admin"))).status).toBe("error");
    expect(createClient).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each(["signed-out", "denied", "error"] as const)("blocks %s sessions", async (status) => {
    vi.mocked(getAuthState).mockResolvedValue({ status });
    const result = await assignMembership(idle, fields());
    expect(result.status).toBe("error");
    expect(createClient).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("blocks verified non-admins and failed admin RPC checks", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await assignMembership(idle, fields())).message).toContain("Only platform administrators");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "connection failed" } });
    expect((await assignMembership(idle, fields())).message).toContain("Could not verify");
    expect(insert).not.toHaveBeenCalled();
  });

  it("reports duplicate composite-key memberships without upserting", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    const result = await assignMembership(idle, fields());
    expect(result.status).toBe("error");
    expect(result.message).toContain("already a member");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a missing user or organization without claiming verification", async () => {
    insert.mockResolvedValue({ error: { code: "23503" } });
    const result = await assignMembership(idle, fields());
    expect(result.message).toContain("was not found");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("fails closed on RLS/permission errors without leaking SQL messages", async () => {
    insert.mockResolvedValue({ error: { code: "42501", message: "sensitive SQL details" } });
    const result = await assignMembership(idle, fields());
    expect(result.status).toBe("error");
    expect(result.message).not.toContain("sensitive SQL details");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateMembership", () => {
  it("updates only role and active, scoped to both membership UUIDs", async () => {
    const result = await updateMembership(idle, fields("leader", USER, ORG, "false"));
    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("is_platform_admin");
    expect(update).toHaveBeenCalledWith({ role: "leader", active: false });
    expect(orgEq).toHaveBeenCalledWith("organization_id", ORG);
    expect(userEq).toHaveBeenCalledWith("user_id", USER);
    expect(selectUpdated).toHaveBeenCalledWith("user_id");
    expect(updateResult).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith(`/organizations/${ORG}`);
  });

  it("reactivates a membership", async () => {
    await updateMembership(idle, fields("staff", USER, ORG, "true"));
    expect(update).toHaveBeenCalledWith({ role: "staff", active: true });
  });

  it("rejects invalid IDs, roles and statuses before database access", async () => {
    for (const values of [
      fields("leader", USER, "invalid", "true"),
      fields("leader", "bad-uuid", ORG, "true"),
      fields("admin", USER, ORG, "true"),
      fields("staff", USER, ORG, "on"),
      fields("staff", USER, ORG),
    ]) {
      expect((await updateMembership(idle, values)).status).toBe("error");
    }
    expect(createClient).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("does not allow signed-out or non-admin users to update roles", async () => {
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "denied" });
    expect((await updateMembership(idle, fields("leader", USER, ORG, "true"))).status).toBe("error");
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await updateMembership(idle, fields("leader", USER, ORG, "true"))).status).toBe("error");
    expect(update).not.toHaveBeenCalled();
  });

  it("treats a zero-row update as missing or inaccessible, not success", async () => {
    updateResult.mockResolvedValue({ data: null, error: null });
    const result = await updateMembership(idle, fields("staff", USER, ORG, "false"));
    expect(result.status).toBe("error");
    expect(result.message).toContain("no longer exists");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("handles failed updates without exposing database internals", async () => {
    updateResult.mockResolvedValue({ data: null, error: { code: "42501", message: "private" } });
    const result = await updateMembership(idle, fields("staff", USER, ORG, "false"));
    expect(result.status).toBe("error");
    expect(result.message).not.toContain("private");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
