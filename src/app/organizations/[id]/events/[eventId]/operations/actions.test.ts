import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  activateEvent, assignEventStaff, revokeEventStaff, type OperationState,
} from "./actions";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ORG = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const STAFF = "33333333-3333-4333-8333-333333333333";
const ASSIGNMENT = "44444444-4444-4444-8444-444444444444";
const initial: OperationState = { status: "idle", message: "" };
const parent = {
  id: EVENT, state: "DRAFT", roster_frozen_at: "2026-12-01T00:00:00Z",
  starts_at: "2026-12-05T00:00:00Z", ends_at: "2026-12-06T00:00:00Z",
};

const rpc = vi.fn();
const eventOne = vi.fn();
const eventQuery = {
  eq: vi.fn(() => eventQuery),
  maybeSingle: eventOne,
};
const membershipOne = vi.fn();
const membershipQuery = {
  eq: vi.fn(() => membershipQuery),
  maybeSingle: membershipOne,
};
const assignmentOne = vi.fn();
const assignmentQuery = {
  eq: vi.fn(() => assignmentQuery),
  maybeSingle: assignmentOne,
};
const rosterEq = vi.fn();
const checkpointEq = vi.fn();
const from = vi.fn((name: string) => ({
  select: vi.fn(() => name === "events" ? eventQuery :
    name === "organization_memberships" ? membershipQuery :
    name === "event_staff" ? assignmentQuery :
    name === "event_roster" ? { eq: rosterEq } : { eq: checkpointEq }),
}));

function form(kind: "assign" | "revoke" | "open", overrides: {
  orgId?: string; eventId?: string; staffId?: string;
  assignmentId?: string; confirmed?: boolean;
} = {}) {
  const data = new FormData();
  data.set("organization_id", overrides.orgId ?? ORG);
  data.set("event_id", overrides.eventId ?? EVENT);
  if (kind === "assign") data.set("staff_user_id", overrides.staffId ?? STAFF);
  if (kind === "revoke") {
    data.set("assignment_id", overrides.assignmentId ?? ASSIGNMENT);
    if (overrides.confirmed !== false) data.set("confirm_revoke", "yes");
  }
  if (kind === "open" && overrides.confirmed !== false) data.set("confirm_open", "yes");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "manager@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ rpc, from } as unknown as Awaited<ReturnType<typeof createClient>>);
  rpc.mockImplementation(async (name: string) => ({
    data: name === "can_manage_org" ? true :
      name === "assign_event_staff" ? ASSIGNMENT :
      name === "revoke_event_staff" ? ASSIGNMENT :
      [{ event_id: EVENT, event_state: "OPEN", opened_at: "2026-12-04T08:00:00Z" }],
    error: null,
  }));
  eventOne.mockResolvedValue({ data: parent, error: null });
  membershipOne.mockResolvedValue({ data: { user_id: STAFF }, error: null });
  assignmentOne.mockResolvedValue({ data: { id: ASSIGNMENT, revoked_at: null }, error: null });
  rosterEq.mockResolvedValue({ count: 2, error: null });
  checkpointEq.mockResolvedValue({
    data: [{ id: "checkpoint", opens_at: "2026-12-05T01:00:00Z", closes_at: "2026-12-05T03:00:00Z" }],
    error: null,
  });
});

describe("event Staff assignment action", () => {
  it.each(["platform Admin", "organization Leader"])("uses only scoped reads and approved RPC for %s", async () => {
    const result = await assignEventStaff(initial, form("assign"));
    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("can_manage_org", { org_id: ORG });
    expect(eventQuery.eq).toHaveBeenCalledWith("organization_id", ORG);
    expect(eventQuery.eq).toHaveBeenCalledWith("id", EVENT);
    expect(membershipQuery.eq).toHaveBeenCalledWith("role", "staff");
    expect(membershipQuery.eq).toHaveBeenCalledWith("active", true);
    expect(rpc).toHaveBeenCalledWith("assign_event_staff", { eid: EVENT, staff_uid: STAFF });
    expect(revalidatePath).toHaveBeenCalledWith("/organizations/" + ORG + "/events/" + EVENT + "/operations");
    expect(from).not.toHaveBeenCalledWith("students");
  });

  it("rejects malformed UUIDs before authentication, reads or RPCs", async () => {
    for (const invalid of [
      form("assign", { orgId: "invalid" }),
      form("assign", { eventId: "invalid" }),
      form("assign", { staffId: "invalid" }),
    ]) expect((await assignEventStaff(initial, invalid)).status).toBe("error");
    expect(getAuthState).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["signed-out", "denied", "error"] as const)("rejects %s identity", async status => {
    vi.mocked(getAuthState).mockResolvedValueOnce({ status });
    expect((await assignEventStaff(initial, form("assign"))).status).toBe("error");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("blocks unauthorized Staff/students and rejects role check outages", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await assignEventStaff(initial, form("assign"))).message).toContain("not authorized");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect((await assignEventStaff(initial, form("assign"))).message).toContain("Could not verify");
    expect(rpc).not.toHaveBeenCalledWith("assign_event_staff", expect.anything());
  });

  it("rejects cross-organization events and ineligible members before RPC", async () => {
    eventOne.mockResolvedValueOnce({ data: null, error: null });
    expect((await assignEventStaff(initial, form("assign"))).message).toContain("not found");
    membershipOne.mockResolvedValueOnce({ data: null, error: null });
    expect((await assignEventStaff(initial, form("assign"))).message).toContain("active Staff");
    expect(rpc).not.toHaveBeenCalledWith("assign_event_staff", expect.anything());
  });

  it("checks event state and handles Backend duplicate/ineligible/revoked-permission errors", async () => {
    eventOne.mockResolvedValueOnce({ data: { ...parent, state: "SYNCING" }, error: null });
    expect((await assignEventStaff(initial, form("assign"))).message).toContain("does not allow");
    for (const [code, phrase] of [
      ["23505", "already has an active"],
      ["22023", "not eligible"],
      ["42501", "permissions may have changed"],
      ["PGRST202", "not available yet"],
    ]) {
      rpc.mockImplementationOnce(async () => ({ data: true, error: null }));
      rpc.mockImplementationOnce(async () => ({ data: null, error: { code, message: "private SQL" } }));
      const result = await assignEventStaff(initial, form("assign"));
      expect(result.status).toBe("error");
      expect(result.message).toContain(phrase);
      expect(result.message).not.toContain("private SQL");
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("never reports success for invalid RPC data or thrown network failures", async () => {
    rpc.mockImplementationOnce(async () => ({ data: true, error: null }));
    rpc.mockImplementationOnce(async () => ({ data: null, error: null }));
    expect((await assignEventStaff(initial, form("assign"))).status).toBe("error");
    vi.mocked(createClient).mockRejectedValueOnce(new Error("offline"));
    expect((await assignEventStaff(initial, form("assign"))).status).toBe("error");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("Staff revocation action", () => {
  it("requires explicit confirmation and UUIDs before any server reads", async () => {
    expect((await revokeEventStaff(initial, form("revoke", { confirmed: false }))).message).toContain("Confirm revocation");
    expect((await revokeEventStaff(initial, form("revoke", { assignmentId: "bad" }))).status).toBe("error");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("checks assignment belongs to scoped event and confirms exact Backend revoked ID", async () => {
    const result = await revokeEventStaff(initial, form("revoke"));
    expect(result.status).toBe("success");
    expect(assignmentQuery.eq).toHaveBeenCalledWith("event_id", EVENT);
    expect(assignmentQuery.eq).toHaveBeenCalledWith("id", ASSIGNMENT);
    expect(rpc).toHaveBeenCalledWith("revoke_event_staff", { assignment_id: ASSIGNMENT });
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("rejects invisible, previously revoked and cross-org assignments", async () => {
    assignmentOne.mockResolvedValueOnce({ data: null, error: null });
    expect((await revokeEventStaff(initial, form("revoke"))).status).toBe("error");
    assignmentOne.mockResolvedValueOnce({ data: { id: ASSIGNMENT, revoked_at: "2026-12-01T00:00:00Z" }, error: null });
    expect((await revokeEventStaff(initial, form("revoke"))).message).toContain("already revoked");
    expect(rpc).not.toHaveBeenCalledWith("revoke_event_staff", expect.anything());
  });

  it("fails closed on changed permissions, repeated revocation, unavailable RPC or nonmatching response", async () => {
    for (const [code, expected] of [
      ["42501", "permissions may have changed"], ["55000", "already been revoked"],
      ["PGRST202", "not available yet"],
    ]) {
      rpc.mockImplementationOnce(async () => ({ data: true, error: null }));
      rpc.mockImplementationOnce(async () => ({ data: null, error: { code } }));
      expect((await revokeEventStaff(initial, form("revoke"))).message).toContain(expected);
    }
    rpc.mockImplementationOnce(async () => ({ data: true, error: null }));
    rpc.mockImplementationOnce(async () => ({ data: STAFF, error: null }));
    expect((await revokeEventStaff(initial, form("revoke"))).status).toBe("error");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("controlled event activation action", () => {
  it("requires deliberate confirmation and valid IDs", async () => {
    expect((await activateEvent(initial, form("open", { confirmed: false }))).message).toContain("Confirm event activation");
    expect((await activateEvent(initial, form("open", { orgId: "bad" }))).status).toBe("error");
    expect(getAuthState).not.toHaveBeenCalled();
  });

  it("activates valid frozen draft only with exact authoritative OPEN result", async () => {
    const result = await activateEvent(initial, form("open"));
    expect(result).toEqual({
      status: "success", message: "Backend confirmed this event is OPEN.",
      openedAt: "2026-12-04T08:00:00Z",
    });
    expect(rpc).toHaveBeenCalledWith("open_event", { eid: EVENT });
    expect(rosterEq).toHaveBeenCalledWith("event_id", EVENT);
    expect(checkpointEq).toHaveBeenCalledWith("event_id", EVENT);
    expect(revalidatePath).toHaveBeenCalledWith("/organizations/" + ORG + "/events");
  });

  it("blocks unfrozen, non-draft, empty roster and invalid checkpoints without RPC", async () => {
    eventOne.mockResolvedValueOnce({ data: { ...parent, roster_frozen_at: null }, error: null });
    expect((await activateEvent(initial, form("open"))).message).toContain("Freeze");
    eventOne.mockResolvedValueOnce({ data: { ...parent, state: "OPEN" }, error: null });
    expect((await activateEvent(initial, form("open"))).message).toContain("DRAFT");
    rosterEq.mockResolvedValueOnce({ count: 0, error: null });
    expect((await activateEvent(initial, form("open"))).status).toBe("error");
    checkpointEq.mockResolvedValueOnce({ data: [{
      id: "invalid", opens_at: "2026-12-04T01:00:00Z", closes_at: "2026-12-05T03:00:00Z",
    }], error: null });
    expect((await activateEvent(initial, form("open"))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalledWith("open_event", expect.anything());
  });

  it("rejects failed readiness queries, permission loss and missing Backend migration", async () => {
    rosterEq.mockResolvedValueOnce({ count: null, error: { code: "42501" } });
    expect((await activateEvent(initial, form("open"))).status).toBe("error");
    for (const [code, snippet] of [
      ["42501", "permissions may have changed"], ["55000", "no longer a DRAFT"],
      ["22023", "rejected event readiness"], ["PGRST202", "not available yet"],
    ]) {
      rpc.mockImplementationOnce(async () => ({ data: true, error: null }));
      rpc.mockImplementationOnce(async () => ({ data: null, error: { code, message: "private" } }));
      expect((await activateEvent(initial, form("open"))).message).toContain(snippet);
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects malformed success payloads, concurrent responses and exceptions without false success", async () => {
    for (const data of [
      [], [{ event_id: EVENT, event_state: "DRAFT", opened_at: "2026-12-04T08:00:00Z" }],
      [{ event_id: STAFF, event_state: "OPEN", opened_at: "2026-12-04T08:00:00Z" }],
      [{ event_id: EVENT, event_state: "OPEN", opened_at: "invalid" }],
    ]) {
      rpc.mockImplementationOnce(async () => ({ data: true, error: null }));
      rpc.mockImplementationOnce(async () => ({ data, error: null }));
      expect((await activateEvent(initial, form("open"))).status).toBe("error");
    }
    vi.mocked(createClient).mockRejectedValueOnce(new Error("connection lost"));
    expect((await activateEvent(initial, form("open"))).status).toBe("error");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
