import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import EventOperationsPage from "./page";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error("Redirect to " + url); }),
  notFound: vi.fn(() => { throw new Error("Not found"); }),
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("./actions", () => ({
  assignEventStaff: vi.fn(),
  revokeEventStaff: vi.fn(),
  activateEvent: vi.fn(),
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const STAFF = "33333333-3333-4333-8333-333333333333";
const PAST = "44444444-4444-4444-8444-444444444444";
const CANDIDATE = "55555555-5555-4555-8555-555555555555";
const entry = {
  id: EVENT, organization_id: ORG, title: "Synthetic Staff Event",
  state: "DRAFT", starts_at: "2026-12-05T00:00:00Z",
  ends_at: "2026-12-06T00:00:00Z",
  roster_frozen_at: "2026-12-04T00:00:00Z", opened_at: null,
};
const active = {
  id: "66666666-6666-4666-8666-666666666666", event_id: EVENT,
  staff_user_id: STAFF, assigned_at: "2026-12-04T01:00:00Z",
  assigned_by: "77777777-7777-4777-8777-777777777777",
  revoked_at: null, revoked_by: null,
};
const revoked = {
  ...active, id: "88888888-8888-4888-8888-888888888888",
  staff_user_id: PAST, revoked_at: "2026-12-04T03:00:00Z",
  revoked_by: "77777777-7777-4777-8777-777777777777",
};

const eventOne = vi.fn();
const eventQuery = { eq: vi.fn(() => eventQuery), maybeSingle: eventOne };
const assignmentOrder = vi.fn();
const assignmentQuery = { eq: vi.fn(() => assignmentQuery), order: assignmentOrder };
const membershipOrder = vi.fn();
const membershipQuery = { eq: vi.fn(() => membershipQuery), order: membershipOrder };
const checkpointEq = vi.fn();
const rosterEq = vi.fn();
const from = vi.fn((table: string) => ({
  select: vi.fn(() => table === "events" ? eventQuery :
    table === "event_staff" ? assignmentQuery :
    table === "organization_memberships" ? membershipQuery :
    table === "event_checkpoints" ? { eq: checkpointEq } : { eq: rosterEq }),
}));
const rpc = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "manager@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ from, rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
  rpc.mockResolvedValue({ data: true, error: null });
  eventOne.mockResolvedValue({ data: entry, error: null });
  assignmentOrder.mockResolvedValue({ data: [active, revoked], error: null });
  membershipOrder.mockResolvedValue({
    data: [{ user_id: STAFF }, { user_id: CANDIDATE }], error: null,
  });
  checkpointEq.mockResolvedValue({
    data: [{ id: "checkpoint", opens_at: "2026-12-05T01:00:00Z", closes_at: "2026-12-05T03:00:00Z" }],
    error: null,
  });
  rosterEq.mockResolvedValue({ count: 2, error: null });
});

async function show(org = ORG, event = EVENT) {
  render(<Providers>{await EventOperationsPage({
    params: Promise.resolve({ id: org, eventId: event }),
  })}</Providers>);
}

describe("scoped event Operations workspace", () => {
  it("shows manager-only active assignments, UUID candidates, revocation history and readiness", async () => {
    await show();
    expect(rpc).toHaveBeenCalledWith("can_manage_org", { org_id: ORG });
    expect(eventQuery.eq).toHaveBeenCalledWith("organization_id", ORG);
    expect(eventQuery.eq).toHaveBeenCalledWith("id", EVENT);
    expect(assignmentQuery.eq).toHaveBeenCalledWith("event_id", EVENT);
    expect(membershipQuery.eq).toHaveBeenCalledWith("organization_id", ORG);
    expect(membershipQuery.eq).toHaveBeenCalledWith("role", "staff");
    expect(membershipQuery.eq).toHaveBeenCalledWith("active", true);
    expect(rosterEq).toHaveBeenCalledWith("event_id", EVENT);
    expect(screen.getByRole("heading", { name: "Synthetic Staff Event — Operations" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Assign event Staff" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Activate event" })).toBeInTheDocument();
    const activeList = screen.getByRole("list", { name: "Active event Staff" });
    expect(within(activeList).getByText(STAFF)).toBeInTheDocument();
    expect(within(activeList).queryByText(PAST)).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Revoked Staff assignment history" })).toHaveTextContent(PAST);
    expect(screen.getByRole("combobox", { name: "Assign active organization Staff" })).toHaveTextContent(CANDIDATE);
    expect(screen.getByText(/no minimum Staff count required/)).toBeInTheDocument();
    expect(from).not.toHaveBeenCalledWith("students");
  });

  it("hides all privileged data and controls for ordinary Staff, students and inactive Leaders", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Only authorized");
    expect(from).not.toHaveBeenCalledWith("events");
    expect(from).not.toHaveBeenCalledWith("event_staff");
    expect(from).not.toHaveBeenCalledWith("organization_memberships");
    expect(screen.queryByRole("form", { name: "Activate event" })).not.toBeInTheDocument();
  });

  it("fails closed on authorization outages", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private" } });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not verify");
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects malformed and RLS-invisible event identifiers", async () => {
    await expect(EventOperationsPage({ params: Promise.resolve({ id: "invalid", eventId: EVENT }) }))
      .rejects.toThrow("Not found");
    expect(createClient).not.toHaveBeenCalled();
    eventOne.mockResolvedValueOnce({ data: null, error: null });
    await expect(EventOperationsPage({ params: Promise.resolve({ id: ORG, eventId: EVENT }) }))
      .rejects.toThrow("Not found");
    expect(from).not.toHaveBeenCalledWith("event_staff");
  });

  it("handles missing Backend columns or assignment table without showing controls", async () => {
    eventOne.mockResolvedValueOnce({ data: null, error: { code: "42703" } });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Milestone 2 Backend");
    expect(screen.queryByRole("form", { name: "Activate event" })).not.toBeInTheDocument();
  });

  it("blocks controls if assignment or readiness query fails, and never fetches roster details", async () => {
    assignmentOrder.mockResolvedValueOnce({ data: null, error: { code: "42P01" } });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Milestone 2 Backend");
    expect(screen.queryByRole("form", { name: "Assign event Staff" })).not.toBeInTheDocument();
    expect(screen.queryByText(STAFF)).not.toBeInTheDocument();
    expect(from).not.toHaveBeenCalledWith("students");
  });

  it("shows an unfrozen event without enabling activation", async () => {
    eventOne.mockResolvedValue({ data: { ...entry, roster_frozen_at: null }, error: null });
    await show();
    expect(screen.getByText(/freeze the roster before activation/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Activate event" })).not.toBeInTheDocument();
    expect(rosterEq).not.toHaveBeenCalled();
  });

  it("hides activation for invalid windows and zero frozen records", async () => {
    checkpointEq.mockResolvedValueOnce({ data: [{
      id: "bad-window", opens_at: "2026-12-04T00:00:00Z", closes_at: "2026-12-05T03:00:00Z",
    }], error: null });
    await show();
    expect(screen.queryByRole("form", { name: "Activate event" })).not.toBeInTheDocument();
  });

  it("shows authoritative OPEN timestamp without offering a duplicate activation", async () => {
    eventOne.mockResolvedValue({
      data: { ...entry, state: "OPEN", opened_at: "2026-12-04T08:00:00Z" }, error: null,
    });
    await show();
    expect(screen.getByText(/Opened at:/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Activate event" })).not.toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Assign event Staff" })).toBeInTheDocument();
  });

  it("denies signed-out, unverified and interrupted identity checks before Supabase data reads", async () => {
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "signed-out" });
    await expect(EventOperationsPage({ params: Promise.resolve({ id: ORG, eventId: EVENT }) }))
      .rejects.toThrow("Redirect to /login");
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "denied" });
    await expect(EventOperationsPage({ params: Promise.resolve({ id: ORG, eventId: EVENT }) }))
      .rejects.toThrow("Redirect to /login?error=access_denied");
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "error" });
    render(<Providers>{await EventOperationsPage({
      params: Promise.resolve({ id: ORG, eventId: EVENT }),
    })}</Providers>);
    expect(screen.getByRole("alert")).toHaveTextContent("Operations unavailable");
    expect(createClient).not.toHaveBeenCalled();
  });
});
