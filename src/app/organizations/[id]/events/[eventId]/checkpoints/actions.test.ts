import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCheckpoint, updateCheckpoint, deleteCheckpoint, type CheckpointActionState,
} from "./actions";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ORG = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const CHECKPOINT = "33333333-3333-4333-8333-333333333333";
const idle: CheckpointActionState = { status: "idle", message: "" };
const path = `/organizations/${ORG}/events/${EVENT}/checkpoints`;

const rpc = vi.fn();
const eventSingle = vi.fn();
const eventEqId = vi.fn(() => ({ maybeSingle: eventSingle }));
const eventEqOrg = vi.fn(() => ({ eq: eventEqId }));
const eventSelect = vi.fn(() => ({ eq: eventEqOrg }));
const createdSingle = vi.fn();
const insertSelect = vi.fn(() => ({ single: createdSingle }));
const insert = vi.fn(() => ({ select: insertSelect }));
const updatedSingle = vi.fn();
const updateSelect = vi.fn(() => ({ maybeSingle: updatedSingle }));
const updateEqId = vi.fn(() => ({ select: updateSelect }));
const updateEqEvent = vi.fn(() => ({ eq: updateEqId }));
const update = vi.fn(() => ({ eq: updateEqEvent }));
const deletedSingle = vi.fn();
const deleteSelect = vi.fn(() => ({ maybeSingle: deletedSingle }));
const deleteEqId = vi.fn(() => ({ select: deleteSelect }));
const deleteEqEvent = vi.fn(() => ({ eq: deleteEqId }));
const del = vi.fn(() => ({ eq: deleteEqEvent }));
const from = vi.fn((table: string) => table === "events"
  ? { select: eventSelect } : { insert, update, delete: del });

function fields(values: {
  organizationId?: string; eventId?: string; checkpointId?: string;
  label?: string; direction?: string; open?: string; close?: string;
  order?: string; confirmed?: boolean;
} = {}) {
  const f = new FormData();
  f.set("organization_id", values.organizationId ?? ORG);
  f.set("event_id", values.eventId ?? EVENT);
  f.set("checkpoint_id", values.checkpointId ?? CHECKPOINT);
  f.set("label", values.label ?? "Morning entry");
  f.set("direction", values.direction ?? "IN");
  f.set("opens_at", values.open ?? "2026-12-05T09:30");
  f.set("closes_at", values.close ?? "2026-12-05T11:00");
  f.set("sort_order", values.order ?? "2");
  if (values.confirmed) f.set("confirm_delete", "yes");
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "leader@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ rpc, from } as unknown as Awaited<ReturnType<typeof createClient>>);
  rpc.mockResolvedValue({ data: true, error: null });
  eventSingle.mockResolvedValue({ data: {
    starts_at: "2026-12-05T01:00:00Z", ends_at: "2026-12-05T04:00:00Z",
    state: "DRAFT", roster_frozen_at: null,
  }, error: null });
  createdSingle.mockResolvedValue({ data: { id: CHECKPOINT }, error: null });
  updatedSingle.mockResolvedValue({ data: { id: CHECKPOINT }, error: null });
  deletedSingle.mockResolvedValue({ data: { id: CHECKPOINT }, error: null });
});

describe("checkpoint creation", () => {
  it("uses only approved INSERT fields, scoped event reads, and refreshes on success", async () => {
    expect((await createCheckpoint(idle, fields())).status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("can_manage_org", { org_id: ORG });
    expect(eventSelect).toHaveBeenCalledWith("starts_at,ends_at,state,roster_frozen_at");
    expect(eventEqOrg).toHaveBeenCalledWith("organization_id", ORG);
    expect(eventEqId).toHaveBeenCalledWith("id", EVENT);
    expect(from).toHaveBeenCalledWith("event_checkpoints");
    expect(insert).toHaveBeenCalledWith({
      event_id: EVENT, label: "Morning entry", direction: "IN",
      opens_at: "2026-12-05T09:30:00+08:00",
      closes_at: "2026-12-05T11:00:00+08:00", sort_order: 2,
    });
    expect(insertSelect).toHaveBeenCalledWith("id");
    expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  it("blocks invalid identifiers without authentication or database activity", async () => {
    for (const data of [fields({ organizationId: "invalid" }), fields({ eventId: "invalid" })]) {
      expect((await createCheckpoint(idle, data)).status).toBe("error");
    }
    expect(getAuthState).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each(["signed-out", "denied", "error"] as const)("blocks %s sessions", async status => {
    vi.mocked(getAuthState).mockResolvedValueOnce({ status });
    expect((await createCheckpoint(idle, fields())).status).toBe("error");
    expect(createClient).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("blocks Staff/inactive leaders and fails closed on authorization RPC failure", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await createCheckpoint(idle, fields())).message).toContain("not authorized");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect((await createCheckpoint(idle, fields())).message).toContain("Could not verify");
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses missing, non-DRAFT, and frozen events", async () => {
    eventSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await createCheckpoint(idle, fields())).message).toContain("not found");
    eventSingle.mockResolvedValueOnce({ data: { state: "OPEN", roster_frozen_at: null }, error: null });
    expect((await createCheckpoint(idle, fields())).message).toContain("unfrozen DRAFT");
    eventSingle.mockResolvedValueOnce({ data: { state: "DRAFT", roster_frozen_at: "2026-12-05T00:00:00Z" }, error: null });
    expect((await createCheckpoint(idle, fields())).message).toContain("unfrozen DRAFT");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects malformed direction and windows outside parent schedule", async () => {
    expect((await createCheckpoint(idle, fields({ direction: "TIME_OUT" }))).status).toBe("error");
    expect((await createCheckpoint(idle, fields({ open: "2026-12-05T08:00" }))).message).toContain("within the event schedule");
    expect(insert).not.toHaveBeenCalled();
  });

  it("reports duplicate labels, freeze races, and rejects errors without leaking SQL", async () => {
    for (const [code, expected] of [
      ["23505", "already exists"], ["42501", "no longer editable"],
      ["22023", "inside"], ["23514", "rejected"],
    ]) {
      createdSingle.mockResolvedValueOnce({ data: null, error: { code, message: "private SQL" } });
      const state = await createCheckpoint(idle, fields());
      expect(state.status).toBe("error");
      expect(state.message).toContain(expected);
      expect(state.message).not.toContain("private SQL");
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("checkpoint editing", () => {
  it("updates only mutable columns, scoped to event and checkpoint identifiers", async () => {
    const result = await updateCheckpoint(idle, fields({ direction: "OUT", order: "10" }));
    expect(result.status).toBe("success");
    expect(update).toHaveBeenCalledWith({
      label: "Morning entry", direction: "OUT", sort_order: 10,
      opens_at: "2026-12-05T09:30:00+08:00",
      closes_at: "2026-12-05T11:00:00+08:00",
    });
    expect(updateEqEvent).toHaveBeenCalledWith("event_id", EVENT);
    expect(updateEqId).toHaveBeenCalledWith("id", CHECKPOINT);
    expect(updateSelect).toHaveBeenCalledWith("id");
    expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  it("rejects malformed IDs, invalid input and cross-event/hidden rows", async () => {
    expect((await updateCheckpoint(idle, fields({ checkpointId: "bad" }))).status).toBe("error");
    expect((await updateCheckpoint(idle, fields({ close: "2026-12-05T13:00" }))).status).toBe("error");
    expect(update).not.toHaveBeenCalled();
    updatedSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await updateCheckpoint(idle, fields())).message).toContain("not found or cannot");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("blocks Staff, frozen events and RLS/trigger failures", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await updateCheckpoint(idle, fields())).status).toBe("error");
    eventSingle.mockResolvedValueOnce({ data: { state: "DRAFT", roster_frozen_at: "2026-12-05T00:00:00Z" }, error: null });
    expect((await updateCheckpoint(idle, fields())).status).toBe("error");
    updatedSingle.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "private SQL" } });
    expect((await updateCheckpoint(idle, fields())).message).toContain("no longer editable");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("checkpoint deletion", () => {
  it("requires explicit user confirmation before checking or changing a record", async () => {
    expect((await deleteCheckpoint(idle, fields())).message).toContain("Confirm deletion");
    expect(createClient).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("deletes only a confirmed checkpoint in the supplied event, then refreshes", async () => {
    const state = await deleteCheckpoint(idle, fields({ confirmed: true }));
    expect(state.status).toBe("success");
    expect(del).toHaveBeenCalledOnce();
    expect(deleteEqEvent).toHaveBeenCalledWith("event_id", EVENT);
    expect(deleteEqId).toHaveBeenCalledWith("id", CHECKPOINT);
    expect(deleteSelect).toHaveBeenCalledWith("id");
    expect(revalidatePath).toHaveBeenCalledWith(path);
  });

  it("rejects hidden/nonexistent rows and never claims success on silent zero-row delete", async () => {
    deletedSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await deleteCheckpoint(idle, fields({ confirmed: true }))).message).toContain("not found or cannot be deleted");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("blocks Staff, non-DRAFT/frozen events and late authorization revocation", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await deleteCheckpoint(idle, fields({ confirmed: true }))).status).toBe("error");
    eventSingle.mockResolvedValueOnce({ data: { state: "OPEN", roster_frozen_at: null }, error: null });
    expect((await deleteCheckpoint(idle, fields({ confirmed: true }))).status).toBe("error");
    deletedSingle.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect((await deleteCheckpoint(idle, fields({ confirmed: true }))).message).toContain("no longer editable");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
