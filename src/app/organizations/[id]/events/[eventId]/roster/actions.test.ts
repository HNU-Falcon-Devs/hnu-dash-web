import { beforeEach, describe, expect, it, vi } from "vitest";
import { freezeEventRoster, type FreezeState } from "./actions";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const ORG = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const idle: FreezeState = { status: "idle", message: "" };
const rpc = vi.fn();
const parentSingle = vi.fn();
const eventEqId = vi.fn(() => ({ maybeSingle: parentSingle }));
const eventEqOrg = vi.fn(() => ({ eq: eventEqId }));
const eventSelect = vi.fn(() => ({ eq: eventEqOrg }));
const checkpointEq = vi.fn();
const checkpointsSelect = vi.fn(() => ({ eq: checkpointEq }));
const from = vi.fn((name: string) => name === "events" ? { select: eventSelect } : { select: checkpointsSelect });

function fields({ org = ORG, event = EVENT, confirmed = true }: {
  org?: string; event?: string; confirmed?: boolean;
} = {}) {
  const form = new FormData();
  form.set("organization_id", org);
  form.set("event_id", event);
  if (confirmed) form.set("confirm_freeze", "yes");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "authorized@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ rpc, from } as unknown as Awaited<ReturnType<typeof createClient>>);
  rpc.mockImplementation(async (name: string) => ({
    data: name === "can_manage_org" ? true : 12, error: null,
  }));
  parentSingle.mockResolvedValue({ data: { id: EVENT, state: "DRAFT", roster_frozen_at: null }, error: null });
  checkpointEq.mockResolvedValue({ count: 1, error: null });
});

describe("irreversible event roster freeze Server Action", () => {
  it.each(["platform administrator", "active organization Leader"])(
    "allows a Backend-authorized %s and uses only the approved freeze RPC", async () => {
      const result = await freezeEventRoster(idle, fields());
      expect(result).toEqual({ status: "success", message: "Backend confirmed 12 frozen student records.", frozenCount: 12 });
      expect(rpc).toHaveBeenCalledWith("can_manage_org", { org_id: ORG });
      expect(eventSelect).toHaveBeenCalledWith("id,state,roster_frozen_at");
      expect(eventEqOrg).toHaveBeenCalledWith("organization_id", ORG);
      expect(eventEqId).toHaveBeenCalledWith("id", EVENT);
      expect(checkpointsSelect).toHaveBeenCalledWith("id", { count: "exact", head: true });
      expect(checkpointEq).toHaveBeenCalledWith("event_id", EVENT);
      expect(rpc).toHaveBeenCalledWith("freeze_event_roster", { eid: EVENT });
      expect(rpc.mock.calls.filter(([name]) => name === "freeze_event_roster")).toHaveLength(1);
      expect(revalidatePath).toHaveBeenCalledWith(`/organizations/${ORG}/events/${EVENT}/roster`);
    },
  );

  it("rejects malformed IDs and absent irreversible confirmation before any DB access", async () => {
    for (const form of [fields({ org: "bad" }), fields({ event: "bad" }), fields({ confirmed: false })]) {
      expect((await freezeEventRoster(idle, form)).status).toBe("error");
    }
    expect(getAuthState).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(["signed-out", "denied", "error", "unconfigured"] as const)(
    "blocks %s sessions before Supabase calls", async status => {
      vi.mocked(getAuthState).mockResolvedValueOnce({ status });
      expect((await freezeEventRoster(idle, fields())).status).toBe("error");
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it.each(["Staff", "ordinary student", "inactive Leader"])(
    "denies a %s when authoritative Backend permissions are false", async () => {
      rpc.mockResolvedValue({ data: false, error: null });
      const result = await freezeEventRoster(idle, fields());
      expect(result.status).toBe("error");
      expect(result.message).toContain("Only authorized");
      expect(rpc).not.toHaveBeenCalledWith("freeze_event_roster", expect.anything());
    },
  );

  it("fails closed on manager RPC failure", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "internal" } });
    expect((await freezeEventRoster(idle, fields())).message).toContain("Could not verify");
    expect(rpc).not.toHaveBeenCalledWith("freeze_event_roster", expect.anything());
  });

  it("rejects cross-organization/RLS-hidden event identifiers", async () => {
    parentSingle.mockResolvedValue({ data: null, error: null });
    expect((await freezeEventRoster(idle, fields())).message).toContain("not found in this organization");
    expect(rpc).not.toHaveBeenCalledWith("freeze_event_roster", expect.anything());
  });

  it("rejects an already frozen event without invoking the freeze RPC", async () => {
    parentSingle.mockResolvedValue({ data: { state: "DRAFT", roster_frozen_at: "2026-11-07T08:00:00Z" }, error: null });
    expect((await freezeEventRoster(idle, fields())).message).toContain("already frozen");
    expect(rpc).not.toHaveBeenCalledWith("freeze_event_roster", expect.anything());
  });

  it("rejects a non-DRAFT event", async () => {
    parentSingle.mockResolvedValue({ data: { state: "OPEN", roster_frozen_at: null }, error: null });
    expect((await freezeEventRoster(idle, fields())).message).toContain("Only unfrozen DRAFT");
    expect(rpc).not.toHaveBeenCalledWith("freeze_event_roster", expect.anything());
  });

  it("rejects missing checkpoints and count-query failures", async () => {
    checkpointEq.mockResolvedValueOnce({ count: 0, error: null });
    expect((await freezeEventRoster(idle, fields())).message).toContain("at least one checkpoint");
    checkpointEq.mockResolvedValueOnce({ count: null, error: { message: "private" } });
    expect((await freezeEventRoster(idle, fields())).message).toContain("Could not verify checkpoints");
    expect(rpc).not.toHaveBeenCalledWith("freeze_event_roster", expect.anything());
  });

  it("handles Backend no-eligible-students or invalid-checkpoint failure without false success", async () => {
    rpc.mockImplementation(async (name: string) => ({
      data: name === "can_manage_org" ? true : null,
      error: name === "freeze_event_roster" ? { code: "22023", message: "private student details" } : null,
    }));
    const result = await freezeEventRoster(idle, fields());
    expect(result.status).toBe("error");
    expect(result.message).toContain("no eligible active BSIT");
    expect(result.message).not.toContain("private student details");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("handles freeze races and permission revocation safely", async () => {
    rpc.mockImplementation(async (name: string) => ({
      data: name === "can_manage_org" ? true : null,
      error: name === "freeze_event_roster" ? { code: "42501", message: "private SQL" } : null,
    }));
    const result = await freezeEventRoster(idle, fields());
    expect(result.status).toBe("error");
    expect(result.message).toContain("no longer editable");
    expect(result.message).not.toContain("private SQL");
  });

  it("never claims success for unexpected counts or network errors", async () => {
    for (const data of [0, null, "12", -1]) {
      rpc.mockImplementationOnce(async () => ({ data: true, error: null }));
      rpc.mockImplementationOnce(async () => ({ data, error: null }));
      expect((await freezeEventRoster(idle, fields())).status).toBe("error");
    }
    rpc.mockImplementationOnce(async () => ({ data: true, error: null }));
    rpc.mockImplementationOnce(async () => ({ data: null, error: { code: "XX000", message: "private" } }));
    expect((await freezeEventRoster(idle, fields())).message).toContain("did not confirm");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
