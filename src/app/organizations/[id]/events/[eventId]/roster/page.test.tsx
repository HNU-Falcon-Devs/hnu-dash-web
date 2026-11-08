import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import EventRosterPage from "./page";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => { throw new Error(`Redirect to ${to}`); }),
  notFound: vi.fn(() => { throw new Error("Not found"); }),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
const ORG = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const parent = {
  id: EVENT, organization_id: ORG, title: "Synthetic Assembly",
  starts_at: "2026-12-05T01:00:00Z", ends_at: "2026-12-05T03:00:00Z",
  target_year_levels: [1, 3], state: "DRAFT", roster_frozen_at: null,
};
const student = {
  student_id: "00001", student_name: "Synthetic Person", program_code: "BSIT",
  year_level: 3, frozen_at: "2026-12-01T00:00:00Z",
};
const eventSingle = vi.fn();
const eventId = vi.fn(() => ({ maybeSingle: eventSingle }));
const eventOrg = vi.fn(() => ({ eq: eventId }));
const eventSelect = vi.fn(() => ({ eq: eventOrg }));
const organizationSingle = vi.fn();
const organizationId = vi.fn(() => ({ maybeSingle: organizationSingle }));
const organizationSelect = vi.fn(() => ({ eq: organizationId }));
const checkpointEq = vi.fn();
const checkpointSelect = vi.fn(() => ({ eq: checkpointEq }));
const snapshotRange = vi.fn();
const snapshotOrder = vi.fn(() => ({ range: snapshotRange }));
const snapshotEq = vi.fn(() => ({ order: snapshotOrder }));
const snapshotSelect = vi.fn(() => ({ eq: snapshotEq }));
const from = vi.fn((table: string) => table === "events" ? { select: eventSelect } :
  table === "organizations" ? { select: organizationSelect } :
  table === "event_checkpoints" ? { select: checkpointSelect } : { select: snapshotSelect });
const rpc = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "manager@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ from, rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
  eventSingle.mockResolvedValue({ data: parent, error: null });
  organizationSingle.mockResolvedValue({ data: { name: "COECS" }, error: null });
  checkpointEq.mockResolvedValue({ count: 1, error: null });
  snapshotRange.mockResolvedValue({ data: [student], count: 1, error: null });
  rpc.mockResolvedValue({ data: true, error: null });
});
async function show(page?: string) {
  render(<Providers>{await EventRosterPage({
    params: Promise.resolve({ id: ORG, eventId: EVENT }),
    searchParams: Promise.resolve(page ? { page } : {}),
  })}</Providers>);
}

describe("event roster readiness and RLS snapshot viewing", () => {
  it("renders event details and draft readiness with no invented eligibility count", async () => {
    await show();
    expect(eventSelect).toHaveBeenCalledWith("id,title,organization_id,starts_at,ends_at,state,target_year_levels,roster_frozen_at");
    expect(eventOrg).toHaveBeenCalledWith("organization_id", ORG);
    expect(eventId).toHaveBeenCalledWith("id", EVENT);
    expect(rpc).toHaveBeenCalledWith("can_manage_org", { org_id: ORG });
    expect(checkpointSelect).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(checkpointEq).toHaveBeenCalledWith("event_id", EVENT);
    expect(screen.getByRole("heading", { name: "Synthetic Assembly — Roster" })).toBeInTheDocument();
    expect(screen.getByText(/COECS/)).toBeInTheDocument();
    expect(screen.getByText(/Target year levels: 1, 3/)).toBeInTheDocument();
    expect(screen.getByText(/Configured checkpoints: 1/)).toBeInTheDocument();
    expect(screen.getByText(/not available for preview/)).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Freeze event roster" })).toBeInTheDocument();
    expect(from).not.toHaveBeenCalledWith("students");
    expect(from).not.toHaveBeenCalledWith("event_roster");
  });

  it("blocks freeze UI when no checkpoints are configured", async () => {
    checkpointEq.mockResolvedValue({ count: 0, error: null });
    await show();
    expect(screen.getByText(/At least one checkpoint is required/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Freeze event roster" })).not.toBeInTheDocument();
  });

  it("blocks freeze UI on incomplete readiness queries", async () => {
    checkpointEq.mockResolvedValue({ count: null, error: { message: "private SQL" } });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not verify");
    expect(screen.queryByRole("form", { name: "Freeze event roster" })).not.toBeInTheDocument();
    expect(screen.queryByText("private SQL")).not.toBeInTheDocument();
  });

  it("shows a frozen snapshot only to Backend managers, not Staff", async () => {
    eventSingle.mockResolvedValue({ data: { ...parent, roster_frozen_at: "2026-12-01T00:00:00Z" }, error: null });
    await show();
    expect(snapshotSelect).toHaveBeenCalledWith("student_id,student_name,program_code,year_level,frozen_at", { count: "exact" });
    expect(snapshotEq).toHaveBeenCalledWith("event_id", EVENT);
    expect(snapshotOrder).toHaveBeenCalledWith("student_id", { ascending: true });
    expect(snapshotRange).toHaveBeenCalledWith(0, 99);
    expect(screen.getByText("Synthetic Person")).toBeInTheDocument();
    expect(screen.getByText("00001")).toBeInTheDocument();
    expect(screen.getByText(/1 students in frozen snapshot/)).toBeInTheDocument();
    expect(screen.getByText(/Frozen at:/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Freeze event roster" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Edit snapshot/)).not.toBeInTheDocument();
  });

  it("paginates frozen snapshot without claiming first page is complete", async () => {
    eventSingle.mockResolvedValue({ data: { ...parent, roster_frozen_at: "2026-12-01T00:00:00Z" }, error: null });
    snapshotRange.mockResolvedValue({ data: [student], count: 205, error: null });
    await show("2");
    expect(snapshotRange).toHaveBeenCalledWith(100, 199);
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", `/organizations/${ORG}/events/${EVENT}/roster?page=1`);
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", `/organizations/${ORG}/events/${EVENT}/roster?page=3`);
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("blocks all roster fields and SELECT queries for Staff, students, inactive Leaders", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Only authorized");
    expect(screen.queryByText(/Target year levels/)).not.toBeInTheDocument();
    expect(from).not.toHaveBeenCalledWith("event_roster");
    expect(from).not.toHaveBeenCalledWith("event_checkpoints");
  });

  it("fails closed on role RPC errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "internal" } });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not verify roster-management permissions");
    expect(from).not.toHaveBeenCalledWith("event_roster");
  });

  it("hides freeze on non-DRAFT events and already-frozen drafts", async () => {
    eventSingle.mockResolvedValueOnce({ data: { ...parent, state: "OPEN" }, error: null });
    await show();
    expect(screen.queryByRole("form", { name: "Freeze event roster" })).not.toBeInTheDocument();
  });

  it("renders safe query errors and empty frozen snapshot state", async () => {
    eventSingle.mockResolvedValue({ data: { ...parent, roster_frozen_at: "2026-12-01T00:00:00Z" }, error: null });
    snapshotRange.mockResolvedValueOnce({ data: [], count: 0, error: null });
    await show();
    expect(screen.getByText(/No snapshot entries are visible/)).toBeInTheDocument();
  });

  it("rejects invalid or RLS-hidden event identifiers", async () => {
    await expect(EventRosterPage({ params: Promise.resolve({ id: "bad", eventId: EVENT }) })).rejects.toThrow("Not found");
    expect(createClient).not.toHaveBeenCalled();
    eventSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(EventRosterPage({ params: Promise.resolve({ id: ORG, eventId: EVENT }) })).rejects.toThrow("Not found");
    expect(snapshotSelect).not.toHaveBeenCalled();
  });

  it("rejects unverified identities before accessing the database", async () => {
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "signed-out" });
    await expect(EventRosterPage({ params: Promise.resolve({ id: ORG, eventId: EVENT }) })).rejects.toThrow("Redirect to /login");
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "denied" });
    await expect(EventRosterPage({ params: Promise.resolve({ id: ORG, eventId: EVENT }) })).rejects.toThrow("Redirect to /login?error=access_denied");
    expect(createClient).not.toHaveBeenCalled();
  });
});
