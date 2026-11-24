import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  activateEvent, assignEventStaff, revokeEventStaff, closeEvent, finalizeEvent, reconcileOffline, type OperationState,
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
  id: EVENT, organization_id: ORG, offline_enabled: false, offline_upload_cutoff: null, state: "DRAFT", roster_frozen_at: "2026-12-01T00:00:00Z",
  starts_at: "2026-12-05T00:00:00Z", ends_at: "2026-12-06T00:00:00Z",
};

const rpc = vi.fn();
const getUser = vi.fn();
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

function form(kind: "assign" | "revoke" | "open" | "close" | "finalize", overrides: {
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
  if (kind === "open") data.set("expected_offline_enabled", "false");
  if (["open", "close", "finalize"].includes(kind) && overrides.confirmed !== false) data.set("confirm_" + kind, "yes");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "manager@hnu.edu.ph" });
  getUser.mockResolvedValue({ data: { user: { id: STAFF } }, error: null });
  vi.mocked(createClient).mockResolvedValue({ rpc, from, auth: { getUser } } as unknown as Awaited<ReturnType<typeof createClient>>);
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


describe("M3.2B lifecycle actions", () => {
  const closed = { event_id: EVENT, event_state: "SYNCING", closed_at: "2026-12-05T03:00:00Z", closed_by: STAFF };
  const finalized = { event_id: EVENT, event_state: "FINALIZED", finalized_at: "2026-12-05T04:00:00Z", finalized_by: STAFF, record_count: 2, replayed: false };
  const path = "/organizations/" + ORG + "/events/" + EVENT + "/operations";
  const setEvent = (state: string) => eventOne.mockResolvedValue({ data: { ...parent, state }, error: null });
  const result = (data: unknown, error: unknown = null) => {
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data, error });
  };

  it.each(["organization Leader", "platform Admin"])("closes an authorized OPEN event for %s using only the event UUID", async () => {
    setEvent("OPEN");
    result(closed);
    expect((await closeEvent(initial, form("close"))).status).toBe("success");
    expect(eventQuery.eq).toHaveBeenCalledWith("organization_id", ORG);
    expect(eventQuery.eq).toHaveBeenCalledWith("id", EVENT);
    expect(rpc.mock.calls).toEqual([["can_manage_org", { org_id: ORG }], ["close_event", { eid: EVENT }]]);
    expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  it.each(["SYNCING", "FINALIZED"])("finalizes or explicitly recovers an original receipt from %s", async state => {
    setEvent(state);
    result({ ...finalized, replayed: state === "FINALIZED" });
    const feedback = await finalizeEvent(initial, form("finalize"));
    expect(feedback.status).toBe("success");
    if (state === "FINALIZED") expect(feedback.message).toContain("original finalized results");
    expect(rpc).toHaveBeenCalledWith("finalize_event", { eid: EVENT });
    expect(revalidatePath).toHaveBeenCalledWith(path);
    expect(from).not.toHaveBeenCalledWith("attendance_records");
  });

  it.each(["close", "finalize"] as const)("rejects invalid IDs and missing confirmation for %s before any auth or RPC", async kind => {
    const action = kind === "close" ? closeEvent : finalizeEvent;
    expect((await action(initial, form(kind, { eventId: "invalid" }))).status).toBe("error");
    expect((await action(initial, form(kind, { confirmed: false }))).status).toBe("error");
    expect(getAuthState).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["signed-out", "denied", "error"] as const)("blocks lifecycle mutations on %s identity", async status => {
    vi.mocked(getAuthState).mockResolvedValue({ status });
    expect((await closeEvent(initial, form("close"))).status).toBe("error");
    expect((await finalizeEvent(initial, form("finalize"))).status).toBe("error");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("denies Staff, foreign scope, permission outages, missing and mismatched event association", async () => {
    setEvent("OPEN");
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await closeEvent(initial, form("close"))).status).toBe("error");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect((await closeEvent(initial, form("close"))).status).toBe("error");
    eventOne.mockResolvedValueOnce({ data: null, error: null });
    expect((await closeEvent(initial, form("close"))).status).toBe("error");
    eventOne.mockResolvedValueOnce({ data: { ...parent, state: "SYNCING", organization_id: STAFF }, error: null });
    expect((await finalizeEvent(initial, form("finalize"))).status).toBe("error");
    expect(rpc.mock.calls.every(([name]) => name === "can_manage_org")).toBe(true);
  });

  it("rejects repeated closure and premature or unsupported finalization before mutation", async () => {
    for (const state of ["DRAFT", "SYNCING", "FINALIZED", "LOCKED"]) {
      setEvent(state);
      expect((await closeEvent(initial, form("close"))).reloadRequired).toBe(true);
    }
    for (const state of ["DRAFT", "OPEN", "LOCKED"]) {
      setEvent(state);
      expect((await finalizeEvent(initial, form("finalize"))).reloadRequired).toBe(true);
    }
    expect(rpc.mock.calls.every(([name]) => name === "can_manage_org")).toBe(true);
  });

  it.each(["42501", "22023", "55000", "PGRST202", "unknown"])("handles Backend %s including early closure without raw errors or blind retry", async code => {
    setEvent("OPEN");
    result(null, { code, message: "private database detail" });
    const feedback = await closeEvent(initial, form("close"));
    expect(feedback.status).toBe("error");
    expect(feedback.reloadRequired).toBe(true);
    expect(feedback.message).not.toContain("private database detail");
    expect(rpc.mock.calls.filter(([name]) => name === "close_event")).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  it("requires authoritative reload on a transport exception after dispatch", async () => {
    setEvent("SYNCING");
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockRejectedValueOnce(new Error("private transport detail"));
    const feedback = await finalizeEvent(initial, form("finalize"));
    expect(feedback.status).toBe("error");
    expect(feedback.reloadRequired).toBe(true);
    expect(feedback.message).not.toContain("private transport detail");
    expect(rpc.mock.calls.filter(([name]) => name === "finalize_event")).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  it.each([null, { ...finalized, event_id: ORG }, { ...finalized, record_count: "2" }, { ...finalized, replayed: null }])(
    "does not claim success for malformed finalization response %#", async data => {
      setEvent("SYNCING");
      result(data);
      const feedback = await finalizeEvent(initial, form("finalize"));
      expect(feedback.status).toBe("error");
      expect(feedback.reloadRequired).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith(path);
    },
  );
});


describe("M4.4 offline reconciliation actions", () => {
  const cutoff = "2026-12-06T03:00:00Z";
  const sealed = "2026-12-06T03:01:00Z";
  const confirmed = "2026-12-06T04:00:00Z";
  const CAPTURE = "66666666-6666-4666-8666-666666666666";
  const RECEIPT = "77777777-7777-4777-8777-777777777777";
  const prep = { preparation_id: ASSIGNMENT, assignment_id: ASSIGNMENT, staff_user_id: STAFF,
    issued_at: "2026-12-05T01:00:00Z", expires_at: "2026-12-05T03:00:00Z", revoked_at: null,
    uploaded_count: 1, disposition: null, declared_count: null, reason: null, accounted_at: null, accounted_by: null };
  const claim = { capture_id: CAPTURE, preparation_id: ASSIGNMENT, checkpoint_id: ASSIGNMENT,
    student_id: "00001234", staff_user_id: STAFF, claimed_at: "2026-12-05T01:01:00Z",
    received_at: "2026-12-05T02:00:00Z", review_eligible: true, decision: null, reason: null,
    receipt_id: null, receipt_outcome: null, reviewed_at: null, reviewed_by: null };
  const summary = { event_id: EVENT, event_state: "SYNCING", upload_cutoff: cutoff,
    sealed_at: sealed, sealed_by: STAFF, confirmed_at: null, confirmed_by: null,
    preparation_count: 1, completed_count: 0, loss_count: 0, unaccounted_count: 1,
    claim_count: 1, reviewed_count: 0, unreviewed_count: 1, can_seal: false, can_confirm: false, can_finalize: false };
  function setup(overrides: Record<string, unknown> = {}, sessions: unknown = [prep], claims: unknown = [claim],
    ack: unknown = null, error: unknown = null) {
    eventOne.mockResolvedValue({ data: { ...parent, state: "SYNCING", offline_enabled: true, offline_upload_cutoff: cutoff }, error: null });
    rpc.mockImplementation(async (name: string) => name === "can_manage_org" ? { data: true, error: null }
      : name === "get_event_offline_summary" ? { data: { ...summary, ...overrides }, error: null }
      : name === "get_event_offline_preparations" ? { data: sessions, error: null }
      : name === "get_event_offline_claims" ? { data: claims, error: null } : { data: ack, error });
  }
  function offline(kind: string, choice = "", why = "", target = ASSIGNMENT) {
    const f = form("finalize");
    f.set("operation", kind); f.set("confirmed", "yes");
    f.set("target_id", target); f.set("choice", choice); f.set("reason", why);
    f.set("preparations_page", "1"); f.set("claims_page", "1");
    return f;
  }
  it("enables explicitly only in DRAFT with authoritative boolean acknowledgment", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: true, error: null });
    expect((await reconcileOffline(initial, offline("enable"))).status).toBe("success");
    expect(rpc.mock.calls).toEqual([["can_manage_org", { org_id: ORG }], ["enable_event_offline", { eid: EVENT }]]);
    setup();
    expect((await reconcileOffline(initial, offline("enable"))).status).toBe("error");
    expect(rpc.mock.calls.filter(([name]) => name === "enable_event_offline")).toHaveLength(1);
  });
  it("blocks stale activation policy without silently enabling offline attendance", async () => {
    eventOne.mockResolvedValue({ data: { ...parent, offline_enabled: true }, error: null });
    expect((await activateEvent(initial, form("open"))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalledWith("open_event", expect.anything());
  });
  it("requires manager permission, matching event scope and explicit confirmation", async () => {
    setup();
    const unconfirmed = offline("seal"); unconfirmed.delete("confirmed");
    expect((await reconcileOffline(initial, unconfirmed)).status).toBe("error");
    expect(getAuthState).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await reconcileOffline(initial, offline("seal"))).status).toBe("error");
    eventOne.mockResolvedValueOnce({ data: { ...parent, organization_id: STAFF }, error: null });
    expect((await reconcileOffline(initial, offline("seal"))).status).toBe("error");
    expect(rpc.mock.calls.every(([name]) => name === "can_manage_org")).toBe(true);
  });
  it("does not read manager evidence for online-only events or missing policy", async () => {
    expect((await reconcileOffline(initial, offline("seal"))).status).toBe("error");
    eventOne.mockResolvedValueOnce({ data: { ...parent, offline_enabled: undefined }, error: null });
    expect((await reconcileOffline(initial, offline("seal"))).status).toBe("error");
    expect(rpc.mock.calls.every(([name]) => name === "can_manage_org")).toBe(true);
  });
  it("uses Backend readiness, never local clock, for sealing", async () => {
    setup({ sealed_at: null, sealed_by: null, can_seal: false });
    expect((await reconcileOffline(initial, offline("seal"))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalledWith("seal_offline_uploads", expect.anything());
    setup({ sealed_at: null, sealed_by: null, can_seal: true }, [], [],
      { event_id: EVENT, sealed_at: sealed, sealed_by: STAFF, replayed: false });
    expect((await reconcileOffline(initial, offline("seal"))).status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("seal_offline_uploads", { eid: EVENT });
  });
  it("blocks unsealed review and ineligible approval, allows explicit rejection", async () => {
    setup({ sealed_at: null, sealed_by: null });
    expect((await reconcileOffline(initial, offline("review", "approve", "Reason", CAPTURE))).status).toBe("error");
    setup({}, [prep], [{ ...claim, review_eligible: false }], {
      capture_id: CAPTURE, decision: "reject", reason: " Insufficient evidence ", receipt_id: null,
      receipt_outcome: null, reviewed_at: confirmed, reviewed_by: STAFF, replayed: false,
    });
    expect((await reconcileOffline(initial, offline("review", "approve", "Reason", CAPTURE))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalledWith("review_offline_capture", expect.anything());
    expect((await reconcileOffline(initial, offline("review", "reject", " Insufficient evidence ", CAPTURE))).status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("review_offline_capture", { eid: EVENT, p_capture_id: CAPTURE,
      p_decision: "reject", p_reason: " Insufficient evidence " });
  });
  it.each(["", "  \n", "x".repeat(501)])("rejects invalid reason without a mutation", async why => {
    setup();
    expect((await reconcileOffline(initial, offline("loss", "lost", why))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("records a loss only with actual durable count and null declaration", async () => {
    const ack = { preparation_id: ASSIGNMENT, disposition: "lost", uploaded_count: 1, declared_count: null,
      reason: "Device lost", accounted_at: confirmed, accounted_by: STAFF, replayed: false };
    setup({}, [prep], [claim], { ...ack, uploaded_count: 9 });
    expect((await reconcileOffline(initial, offline("loss", "lost", "Device lost"))).status).toBe("error");
    setup({}, [prep], [claim], ack);
    expect((await reconcileOffline(initial, offline("loss", "lost", "Device lost"))).status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("account_offline_preparation_loss", { eid: EVENT,
      p_preparation_id: ASSIGNMENT, p_disposition: "lost", p_reason: "Device lost" });
  });
  it("validates replay audit and rejects conflicting decisions without mutation", async () => {
    const reviewed = { ...claim, decision: "approve", reason: " exact ", receipt_id: RECEIPT,
      receipt_outcome: "duplicate", reviewed_at: confirmed, reviewed_by: ORG };
    const ack = { capture_id: CAPTURE, decision: "approve", reason: " exact ", receipt_id: RECEIPT,
      receipt_outcome: "duplicate", reviewed_at: confirmed, reviewed_by: ORG, replayed: true };
    setup({ reviewed_count: 1, unreviewed_count: 0 }, [prep], [reviewed], ack);
    expect((await reconcileOffline(initial, offline("review", "approve", "exact", CAPTURE))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalledWith("review_offline_capture", expect.anything());
    expect((await reconcileOffline(initial, offline("review", "approve", " exact ", CAPTURE))).status).toBe("success");
    setup({ reviewed_count: 1, unreviewed_count: 0 }, [prep], [reviewed], { ...ack, reviewed_by: STAFF });
    expect((await reconcileOffline(initial, offline("review", "approve", " exact ", CAPTURE))).status).toBe("error");
  });
  it("requires reload on response loss or Backend immutable conflict, without automatic retry", async () => {
    setup();
    rpc.mockImplementation(async (name: string) => {
      if (name === "can_manage_org") return { data: true, error: null };
      if (name === "get_event_offline_summary") return { data: summary, error: null };
      if (name === "get_event_offline_preparations") return { data: [prep], error: null };
      if (name === "get_event_offline_claims") return { data: [claim], error: null };
      throw new Error("private transport detail");
    });
    const feedback = await reconcileOffline(initial, offline("review", "reject", "Reason", CAPTURE));
    expect(feedback.reloadRequired).toBe(true);
    expect(feedback.message).not.toContain("private transport");
    expect(rpc.mock.calls.filter(([name]) => name === "review_offline_capture")).toHaveLength(1);
    setup({}, [prep], [claim], null, { code: "23505", message: "private" });
    expect((await reconcileOffline(initial, offline("review", "reject", "Reason", CAPTURE))).message).toContain("conflicting immutable");
  });
  it("requires seal and confirmation even with zero known sessions/claims, blocks old finalization form", async () => {
    const zero = { preparation_count: 0, unaccounted_count: 0, claim_count: 0, unreviewed_count: 0 };
    setup({ ...zero, sealed_at: null, sealed_by: null }, [], []);
    expect((await reconcileOffline(initial, offline("confirm"))).status).toBe("error");
    const finalize = form("finalize");
    finalize.set("confirm_offline_finalize", "yes");
    expect((await finalizeEvent(initial, finalize)).status).toBe("error");
    setup({ ...zero, can_confirm: true }, [], [], { event_id: EVENT, confirmed_at: confirmed, confirmed_by: STAFF, replayed: false });
    expect((await reconcileOffline(initial, offline("confirm"))).status).toBe("success");
    setup({ ...zero, confirmed_at: confirmed, confirmed_by: STAFF, can_finalize: true }, [], [], {
      event_id: EVENT, event_state: "FINALIZED", finalized_at: confirmed, finalized_by: STAFF, record_count: 2, replayed: false });
    expect((await finalizeEvent(initial, form("finalize"))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalledWith("finalize_event", expect.anything());
    expect((await finalizeEvent(initial, finalize)).status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("finalize_event", { eid: EVENT });
  });
  it("blocks finalization for malformed evidence despite a ready summary", async () => {
    setup({ preparation_count: 0, unaccounted_count: 0, claim_count: 0, unreviewed_count: 0,
      confirmed_at: confirmed, confirmed_by: STAFF, can_finalize: true }, [], [claim]);
    const f = form("finalize"); f.set("confirm_offline_finalize", "yes");
    expect((await finalizeEvent(initial, f)).status).toBe("error");
    expect(rpc).not.toHaveBeenCalledWith("finalize_event", expect.anything());
  });
});
