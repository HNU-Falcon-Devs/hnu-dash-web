import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import EventCheckpointsPage from "./page";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`Redirect to ${url}`); }),
  notFound: vi.fn(() => { throw new Error("Not found"); }),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const CHECKPOINT = "33333333-3333-4333-8333-333333333333";
const parent = {
  id: EVENT, title: "General Assembly", starts_at: "2026-12-05T01:00:00Z",
  ends_at: "2026-12-05T04:00:00Z", state: "DRAFT", roster_frozen_at: null,
};
const example = {
  id: CHECKPOINT, event_id: EVENT, label: "Morning entry", direction: "IN",
  opens_at: "2026-12-05T01:30:00Z", closes_at: "2026-12-05T03:00:00Z", sort_order: 3,
};

const eventOne = vi.fn();
const eventEqId = vi.fn(() => ({ maybeSingle: eventOne }));
const eventEqOrg = vi.fn(() => ({ eq: eventEqId }));
const eventSelect = vi.fn(() => ({ eq: eventEqOrg }));
const secondOrder = vi.fn();
const firstOrder = vi.fn(() => ({ order: secondOrder }));
const checkpointEq = vi.fn(() => ({ order: firstOrder }));
const checkpointSelect = vi.fn(() => ({ eq: checkpointEq }));
const from = vi.fn((table: string) => table === "events"
  ? { select: eventSelect } : { select: checkpointSelect });
const rpc = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "staff@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ from, rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
  eventOne.mockResolvedValue({ data: parent, error: null });
  secondOrder.mockResolvedValue({ data: [example], error: null });
  rpc.mockResolvedValue({ data: false, error: null });
});

async function show(id = ORG, eventId = EVENT) {
  render(<Providers>{await EventCheckpointsPage({ params: Promise.resolve({ id, eventId }) })}</Providers>);
}

describe("RLS-scoped checkpoint page", () => {
  it("shows event-scoped checkpoints with Manila times, sort order and direction to Staff", async () => {
    await show();
    expect(eventSelect).toHaveBeenCalledWith("id,title,starts_at,ends_at,state,roster_frozen_at");
    expect(eventEqOrg).toHaveBeenCalledWith("organization_id", ORG);
    expect(eventEqId).toHaveBeenCalledWith("id", EVENT);
    expect(checkpointSelect).toHaveBeenCalledWith("id,event_id,label,direction,opens_at,closes_at,sort_order");
    expect(checkpointEq).toHaveBeenCalledWith("event_id", EVENT);
    expect(firstOrder).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(secondOrder).toHaveBeenCalledWith("opens_at", { ascending: true });
    expect(rpc).toHaveBeenCalledWith("can_manage_org", { org_id: ORG });

    const list = screen.getByRole("list", { name: "Event checkpoints" });
    expect(within(list).getByText("Morning entry")).toBeInTheDocument();
    expect(within(list).getByText("IN")).toBeInTheDocument();
    expect(within(list).getByText(/9:30/)).toBeInTheDocument();
    expect(within(list).getByText("3")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Create checkpoint" })).not.toBeInTheDocument();
    expect(screen.queryByText("Edit checkpoint")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete checkpoint")).not.toBeInTheDocument();
  });

  it("shows create/edit/delete controls only for Backend-approved managers of editable DRAFT events", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await show();
    const creator = screen.getByRole("form", { name: "Create checkpoint" });
    expect(creator).toBeInTheDocument();
    expect(within(creator).getByLabelText("Opens (Philippine time)")).toHaveAttribute("min", "2026-12-05T09:00");
    const editor = screen.getByRole("form", { name: "Edit checkpoint Morning entry" });
    expect(within(editor).getByLabelText("Direction")).toHaveValue("IN");
    expect(within(editor).getByLabelText("Sort order")).toHaveValue(3);
    expect(within(editor).getByLabelText("Opens (Philippine time)")).toHaveValue("2026-12-05T09:30");
    const deletion = screen.getByRole("form", { name: "Delete checkpoint Morning entry" });
    expect(within(deletion).getByRole("checkbox", { name: /I confirm deleting/ })).toBeRequired();
    expect(within(deletion).getByRole("button", { name: "Delete checkpoint" })).toBeInTheDocument();
  });

  it("locks all mutation controls when the event is not an unfrozen DRAFT", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    eventOne.mockResolvedValueOnce({ data: { ...parent, state: "OPEN" }, error: null });
    await show();
    expect(screen.getByText(/Checkpoint changes are locked/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Create checkpoint" })).not.toBeInTheDocument();
  });

  it("locks mutations when the roster is frozen even if state remains DRAFT", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    eventOne.mockResolvedValueOnce({ data: { ...parent, roster_frozen_at: "2026-12-05T00:00:00Z" }, error: null });
    await show();
    expect(screen.queryByRole("form", { name: "Create checkpoint" })).not.toBeInTheDocument();
    expect(screen.getByText(/Checkpoint changes are locked/)).toBeInTheDocument();
  });

  it("retains the readable list but hides controls if Backend permission checking fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "sensitive" } });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not verify checkpoint-management permissions");
    expect(screen.queryByRole("form", { name: "Create checkpoint" })).not.toBeInTheDocument();
    expect(screen.getByText("Morning entry")).toBeInTheDocument();
  });

  it("shows the empty RLS-visible state and does not fabricate checkpoints", async () => {
    secondOrder.mockResolvedValue({ data: [], error: null });
    await show();
    expect(screen.getByText("No checkpoints are configured for this event.")).toBeInTheDocument();
  });

  it("hides creation when checkpoint listing fails rather than treating failure as empty", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    secondOrder.mockResolvedValue({ data: null, error: { message: "internal SQL" } });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load checkpoints");
    expect(screen.queryByRole("form", { name: "Create checkpoint" })).not.toBeInTheDocument();
  });

  it("404s invalid and RLS-hidden event IDs", async () => {
    await expect(EventCheckpointsPage({ params: Promise.resolve({ id: "bad", eventId: EVENT }) })).rejects.toThrow("Not found");
    expect(createClient).not.toHaveBeenCalled();
    eventOne.mockResolvedValueOnce({ data: null, error: null });
    await expect(EventCheckpointsPage({ params: Promise.resolve({ id: ORG, eventId: EVENT }) })).rejects.toThrow("Not found");
    expect(checkpointSelect).not.toHaveBeenCalled();
  });

  it("reports a safe event fetch error instead of an empty event", async () => {
    eventOne.mockResolvedValueOnce({ data: null, error: { message: "private SQL" } });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load this event");
    expect(screen.queryByText("private SQL")).not.toBeInTheDocument();
  });

  it("redirects signed-out and denied users before querying the database", async () => {
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "signed-out" });
    await expect(EventCheckpointsPage({ params: Promise.resolve({ id: ORG, eventId: EVENT }) })).rejects.toThrow("Redirect to /login");
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "denied" });
    await expect(EventCheckpointsPage({ params: Promise.resolve({ id: ORG, eventId: EVENT }) })).rejects.toThrow("Redirect to /login?error=access_denied");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("fails closed when identity verification is unavailable", async () => {
    vi.mocked(getAuthState).mockResolvedValue({ status: "error" });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Checkpoints are unavailable");
    expect(createClient).not.toHaveBeenCalled();
  });
});
