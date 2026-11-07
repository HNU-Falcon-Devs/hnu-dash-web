import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraftEvent, updateDraftEvent, type EventActionState } from "./actions";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ORG = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const idle: EventActionState = { status: "idle", message: "" };

const rpc = vi.fn();
const insertedSingle = vi.fn();
const insertedSelect = vi.fn(() => ({ single: insertedSingle }));
const insert = vi.fn(() => ({ select: insertedSelect }));
const eventSingle = vi.fn();
const eventEqId = vi.fn(() => ({ maybeSingle: eventSingle }));
const eventEqOrg = vi.fn(() => ({ eq: eventEqId }));
const readSelect = vi.fn(() => ({ eq: eventEqOrg }));
const from = vi.fn(() => ({ insert, select: readSelect }));

function fields(params: { organizationId?: string; eventId?: string; role?: string; title?: string; startsAt?: string; endsAt?: string; years?: string[] } = {}) {
  const form = new FormData();
  form.set("organization_id", params.organizationId ?? ORG);
  form.set("event_id", params.eventId ?? EVENT);
  form.set("title", params.title ?? "Draft Symposium");
  form.set("starts_at", params.startsAt ?? "2026-12-05T09:00");
  form.set("ends_at", params.endsAt ?? "2026-12-05T10:00");
  for (const y of params.years ?? ["1", "3"]) form.append("year_levels", y);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "leader@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ rpc, from } as unknown as Awaited<ReturnType<typeof createClient>>);
  rpc.mockImplementation(async (name: string) => ({
    data: name === "can_manage_org" ? true : null,
    error: null,
  }));
  insertedSingle.mockResolvedValue({ data: { id: EVENT }, error: null });
  eventSingle.mockResolvedValue({ data: { id: EVENT, state: "DRAFT", roster_frozen_at: null }, error: null });
});

describe("createDraftEvent", () => {
  it("creates only approved columns, with explicit Manila offsets, and refreshes scope", async () => {
    const result = await createDraftEvent(idle, fields());
    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("can_manage_org", { org_id: ORG });
    expect(from).toHaveBeenCalledWith("events");
    expect(insert).toHaveBeenCalledWith({
      organization_id: ORG,
      title: "Draft Symposium",
      starts_at: "2026-12-05T09:00:00+08:00",
      ends_at: "2026-12-05T10:00:00+08:00",
      target_year_levels: [1, 3],
    });
    expect(insertedSelect).toHaveBeenCalledWith("id");
    expect(revalidatePath).toHaveBeenCalledWith(`/organizations/${ORG}/events`);
  });

  it("blocks signed-out and failed identity checks", async () => {
    for (const status of ["signed-out", "denied", "error"] as const) {
      vi.mocked(getAuthState).mockResolvedValueOnce({ status });
      expect((await createDraftEvent(idle, fields())).status).toBe("error");
    }
    expect(createClient).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("blocks Staff and inactive leaders when Backend can_manage_org returns false", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const result = await createDraftEvent(idle, fields());
    expect(result.message).toContain("not authorized");
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails closed when the manager RPC cannot verify permissions", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect((await createDraftEvent(idle, fields())).status).toBe("error");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects invalid organization, title, schedule and year levels before database use", async () => {
    for (const f of [
      fields({ organizationId: "invalid" }),
      fields({ title: "x" }),
      fields({ startsAt: "2026-12-05T11:00", endsAt: "2026-12-05T10:00" }),
      fields({ years: [] }),
    ]) {
      expect((await createDraftEvent(idle, f)).status).toBe("error");
    }
    expect(createClient).not.toHaveBeenCalled();
  });

  it("handles missing organization and constraint/database failures without claiming success", async () => {
    insertedSingle.mockResolvedValueOnce({ data: null, error: { code: "23503" } });
    expect((await createDraftEvent(idle, fields())).message).toContain("Organization was not found");
    insertedSingle.mockResolvedValueOnce({ data: null, error: { code: "23514" } });
    expect((await createDraftEvent(idle, fields())).message).toContain("rejected by the Backend");
    insertedSingle.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "private SQL" } });
    const failed = await createDraftEvent(idle, fields());
    expect(failed.status).toBe("error");
    expect(failed.message).not.toContain("private SQL");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateDraftEvent", () => {
  it("checks org+event scope and calls exact approved RPC parameters", async () => {
    const result = await updateDraftEvent(idle, fields({ title: "  Revised symposium  " }));
    expect(result.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("can_manage_org", { org_id: ORG });
    expect(readSelect).toHaveBeenCalledWith("id,state,roster_frozen_at");
    expect(eventEqOrg).toHaveBeenCalledWith("organization_id", ORG);
    expect(eventEqId).toHaveBeenCalledWith("id", EVENT);
    expect(rpc).toHaveBeenCalledWith("update_draft_event", {
      eid: EVENT,
      new_title: "Revised symposium",
      new_starts_at: "2026-12-05T09:00:00+08:00",
      new_ends_at: "2026-12-05T10:00:00+08:00",
      new_target_year_levels: [1, 3],
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/organizations/${ORG}/events`);
  });

  it("rejects invalid IDs, schedules and year levels before any mutation", async () => {
    for (const f of [
      fields({ organizationId: "invalid" }),
      fields({ eventId: "invalid" }),
      fields({ startsAt: "not-a-date" }),
      fields({ years: ["7"] }),
    ]) expect((await updateDraftEvent(idle, f)).status).toBe("error");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("does not let Staff or unverified identities invoke the edit RPC", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await updateDraftEvent(idle, fields())).status).toBe("error");
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "denied" });
    expect((await updateDraftEvent(idle, fields())).status).toBe("error");
    expect(eventSingle).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith("update_draft_event", expect.anything());
  });

  it("rejects cross-org or RLS-invisible events", async () => {
    eventSingle.mockResolvedValue({ data: null, error: null });
    expect((await updateDraftEvent(idle, fields())).message).toContain("not found in this organization");
    expect(rpc).not.toHaveBeenCalledWith("update_draft_event", expect.anything());
  });

  it("rejects non-draft events and frozen drafts", async () => {
    eventSingle.mockResolvedValueOnce({ data: { state: "OPEN", roster_frozen_at: null }, error: null });
    expect((await updateDraftEvent(idle, fields())).message).toContain("Only unfrozen draft");
    eventSingle.mockResolvedValueOnce({ data: { state: "DRAFT", roster_frozen_at: "2026-12-05T00:00:00Z" }, error: null });
    expect((await updateDraftEvent(idle, fields())).message).toContain("Only unfrozen draft");
    expect(rpc).not.toHaveBeenCalledWith("update_draft_event", expect.anything());
  });

  it("reports RPC authorization revocation and checkpoint schedule conflicts", async () => {
    rpc.mockImplementation(async (name: string) => ({
      data: name === "can_manage_org" ? true : null,
      error: name === "update_draft_event" ? { code: "42501" } : null,
    }));
    expect((await updateDraftEvent(idle, fields())).message).toContain("no longer an editable draft");
    rpc.mockImplementation(async (name: string) => ({
      data: name === "can_manage_org" ? true : null,
      error: name === "update_draft_event" ? { code: "22023" } : null,
    }));
    expect((await updateDraftEvent(idle, fields())).message).toContain("exclude an existing checkpoint");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("fails closed on event read or unexpected RPC errors", async () => {
    eventSingle.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "sensitive" } });
    expect((await updateDraftEvent(idle, fields())).message).not.toContain("sensitive");
    rpc.mockImplementation(async (name: string) => ({
      data: name === "can_manage_org" ? true : null,
      error: name === "update_draft_event" ? { code: "XX000", message: "private" } : null,
    }));
    const failed = await updateDraftEvent(idle, fields());
    expect(failed.message).toMatch(/Could not update/);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
