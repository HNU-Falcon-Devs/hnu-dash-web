import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  closeEvent: vi.fn(),
  finalizeEvent: vi.fn(),
  reconcileOffline: vi.fn(),
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const STAFF = "33333333-3333-4333-8333-333333333333";
const PAST = "44444444-4444-4444-8444-444444444444";
const CANDIDATE = "55555555-5555-4555-8555-555555555555";
const CHECKPOINT = "99999999-9999-4999-8999-999999999999";
const entry = {
  id: EVENT, organization_id: ORG, offline_enabled: false, offline_upload_cutoff: null, title: "Synthetic Staff Event",
  state: "DRAFT", starts_at: "2026-12-05T00:00:00Z",
  ends_at: "2026-12-06T00:00:00Z",
  roster_frozen_at: "2026-12-04T00:00:00Z", opened_at: null,
};
const checkpoint = {
  id: CHECKPOINT, label: "Morning entry", direction: "IN", sort_order: 1,
  opens_at: "2026-12-05T01:00:00Z", closes_at: "2026-12-05T03:00:00Z",
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
const acceptedRow = {
  student_id: "00001234",
  checkpoint_id: CHECKPOINT,
  checkpoint_label: "Morning entry",
  checkpoint_direction: "IN",
  checkpoint_sort_order: 1,
  has_accepted_scan: true,
  accepted_received_at: "2026-12-05T01:00:00Z",
};
const unrecordedRow = {
  ...acceptedRow,
  student_id: "00005678",
  has_accepted_scan: false,
  accepted_received_at: null,
};

const eventOne = vi.fn();
const eventQuery = { eq: vi.fn(() => eventQuery), maybeSingle: eventOne };
const assignmentOrder = vi.fn();
const assignmentQuery = { eq: vi.fn(() => assignmentQuery), order: assignmentOrder };
const membershipOrder = vi.fn();
const membershipQuery = { eq: vi.fn(() => membershipQuery), order: membershipOrder };
const checkpointOrder = vi.fn();
const checkpointQuery = { eq: vi.fn(() => checkpointQuery), order: checkpointOrder };
const rosterEq = vi.fn();
const from = vi.fn((table: string) => ({
  select: vi.fn(() => table === "events" ? eventQuery :
    table === "event_staff" ? assignmentQuery :
    table === "organization_memberships" ? membershipQuery :
    table === "event_checkpoints" ? checkpointQuery : { eq: rosterEq }),
}));
const rpc = vi.fn();

function coverageCalls() {
  return rpc.mock.calls.filter(([name]) => name === "get_event_checkpoint_coverage");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "manager@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ from, rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
  rpc.mockImplementation(async (name: string) => {
    if (name === "can_manage_org") return { data: true, error: null };
    if (name === "get_event_checkpoint_coverage") return { data: [], error: null };
    return { data: null, error: null };
  });
  eventOne.mockResolvedValue({ data: entry, error: null });
  assignmentOrder.mockResolvedValue({ data: [active, revoked], error: null });
  membershipOrder.mockResolvedValue({
    data: [{ user_id: STAFF }, { user_id: CANDIDATE }], error: null,
  });
  checkpointOrder.mockResolvedValue({ data: [checkpoint], error: null });
  rosterEq.mockResolvedValue({ count: 2, error: null });
});

async function show(
  org = ORG,
  event = EVENT,
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  render(<Providers>{await EventOperationsPage({
    params: Promise.resolve({ id: org, eventId: event }),
    searchParams: Promise.resolve(searchParams),
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
    expect(screen.getByText("Provisional checkpoint coverage")).toBeInTheDocument();
    expect(from).not.toHaveBeenCalledWith("students");
  });

  it.each(["authorized organization Leader", "verified platform Administrator"])(
    "requests provisional coverage for an authorized %s",
    async () => {
      await show();
      expect(rpc).toHaveBeenCalledWith("can_manage_org", { org_id: ORG });
      expect(rpc).toHaveBeenCalledWith("get_event_checkpoint_coverage", {
        eid: EVENT, p_limit: 200, p_offset: 0,
      });
    },
  );

  it("does not request coverage for assigned Staff or other unauthorized users", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Only authorized");
    expect(coverageCalls()).toHaveLength(0);
    expect(from).not.toHaveBeenCalledWith("events");
    expect(from).not.toHaveBeenCalledWith("event_staff");
    expect(from).not.toHaveBeenCalledWith("organization_memberships");
    expect(screen.queryByRole("form", { name: "Activate event" })).not.toBeInTheDocument();
  });

  it("fails closed on authorization outages without requesting coverage", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private" } });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not verify");
    expect(from).not.toHaveBeenCalled();
    expect(coverageCalls()).toHaveLength(0);
  });

  it("rejects malformed and RLS-invisible event identifiers", async () => {
    await expect(EventOperationsPage({ params: Promise.resolve({ id: "invalid", eventId: EVENT }) }))
      .rejects.toThrow("Not found");
    expect(createClient).not.toHaveBeenCalled();
    eventOne.mockResolvedValueOnce({ data: null, error: null });
    await expect(EventOperationsPage({ params: Promise.resolve({ id: ORG, eventId: EVENT }) }))
      .rejects.toThrow("Not found");
    expect(from).not.toHaveBeenCalledWith("event_staff");
    expect(coverageCalls()).toHaveLength(0);
  });

  it("handles missing Backend columns or assignment table without showing controls", async () => {
    eventOne.mockResolvedValueOnce({ data: null, error: { code: "42703" } });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Milestone 2 Backend");
    expect(screen.queryByRole("form", { name: "Activate event" })).not.toBeInTheDocument();
    expect(coverageCalls()).toHaveLength(0);
  });

  it("blocks controls if assignment or readiness query fails, and never fetches roster details", async () => {
    assignmentOrder.mockResolvedValueOnce({ data: null, error: { code: "42P01" } });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Milestone 2 Backend");
    expect(screen.queryByRole("form", { name: "Assign event Staff" })).not.toBeInTheDocument();
    expect(screen.queryByText(STAFF)).not.toBeInTheDocument();
    expect(from).not.toHaveBeenCalledWith("students");
    expect(coverageCalls()).toHaveLength(0);
  });

  it("shows an unfrozen event without enabling activation or requesting coverage", async () => {
    eventOne.mockResolvedValue({ data: { ...entry, roster_frozen_at: null }, error: null });
    await show();
    expect(screen.getByText(/freeze the roster before activation/)).toBeInTheDocument();
    expect(screen.getByText(/coverage becomes available after the event roster is frozen/i)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Activate event" })).not.toBeInTheDocument();
    expect(rosterEq).not.toHaveBeenCalled();
    expect(coverageCalls()).toHaveLength(0);
  });

  it("does not request coverage when no checkpoints are configured", async () => {
    checkpointOrder.mockResolvedValueOnce({ data: [], error: null });
    await show();
    expect(screen.getByText("No checkpoints are configured for this event.")).toBeInTheDocument();
    expect(coverageCalls()).toHaveLength(0);
  });

  it("does not request coverage when the frozen roster has no entries", async () => {
    rosterEq.mockResolvedValueOnce({ count: 0, error: null });
    await show();
    expect(screen.getByText("No frozen roster entries are available for checkpoint coverage.")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Activate event" })).not.toBeInTheDocument();
    expect(coverageCalls()).toHaveLength(0);
  });

  it("hides activation for invalid checkpoint windows", async () => {
    checkpointOrder.mockResolvedValueOnce({ data: [{
      ...checkpoint, id: "bad-window",
      opens_at: "2026-12-04T00:00:00Z", closes_at: "2026-12-05T03:00:00Z",
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
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("provisional checkpoint coverage", () => {
  it("normalizes invalid coverage_page values to the first page", async () => {
    await show(ORG, EVENT, { coverage_page: "not-a-page" });
    expect(rpc).toHaveBeenCalledWith("get_event_checkpoint_coverage", {
      eid: EVENT, p_limit: 200, p_offset: 0,
    });
  });

  it("uses the bounded 200-row page size and preserves other query parameters", async () => {
    checkpointOrder.mockResolvedValueOnce({
      data: [1, 2, 3, 4].map((number) => ({
        ...checkpoint,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-" + String(number).padStart(12, "0"),
        label: "Checkpoint " + number,
        sort_order: number,
      })),
      error: null,
    });
    rosterEq.mockResolvedValueOnce({ count: 600, error: null });
    await show(ORG, EVENT, { page: "7", coverage_page: "2" });
    expect(rpc).toHaveBeenCalledWith("get_event_checkpoint_coverage", {
      eid: EVENT, p_limit: 200, p_offset: 200,
    });
    expect(screen.getByRole("link", { name: "Next coverage page" })).toHaveAttribute(
      "href", "/organizations/" + ORG + "/events/" + EVENT + "/operations?page=7&coverage_page=3",
    );
  });

  it("clamps out-of-range coverage pages to the last available page", async () => {
    checkpointOrder.mockResolvedValueOnce({
      data: [1, 2, 3, 4].map((number) => ({
        ...checkpoint,
        id: "bbbbbbbb-bbbb-4bbb-8bbb-" + String(number).padStart(12, "0"),
        label: "Checkpoint " + number,
        sort_order: number,
      })),
      error: null,
    });
    rosterEq.mockResolvedValueOnce({ count: 600, error: null });
    await show(ORG, EVENT, { coverage_page: "999" });
    expect(rpc).toHaveBeenCalledWith("get_event_checkpoint_coverage", {
      eid: EVENT, p_limit: 200, p_offset: 2200,
    });
    expect(screen.getByText(/Page 12 of 12/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Next coverage page" })).not.toBeInTheDocument();
  });

  it("preserves leading-zero student IDs and displays Backend receipt time in Manila", async () => {
    const timestamp = "2026-12-05T01:00:00Z";
    rpc.mockImplementation(async (name: string) => {
      if (name === "can_manage_org") return { data: true, error: null };
      if (name === "get_event_checkpoint_coverage") {
        return { data: [acceptedRow, unrecordedRow], error: null };
      }
      return { data: null, error: null };
    });
    await show();
    const expectedTimestamp = new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
    }).format(new Date(timestamp));
    expect(screen.getByText("00001234")).toBeInTheDocument();
    expect(screen.getByText("00005678")).toBeInTheDocument();
    expect(screen.getByText("Accepted receipt recorded")).toBeInTheDocument();
    expect(screen.getByText("No accepted receipt recorded")).toBeInTheDocument();
    expect(screen.getByText(expectedTimestamp)).toBeInTheDocument();
    expect(screen.getByText("Backend received at (Asia/Manila)")).toBeInTheDocument();
    expect(screen.queryByText(/\bABSENT\b/)).not.toBeInTheDocument();
  });

  it("reports an unavailable timestamp when an accepted receipt has no timestamp", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "can_manage_org") return { data: true, error: null };
      if (name === "get_event_checkpoint_coverage") {
        return { data: [{ ...acceptedRow, accepted_received_at: null }], error: null };
      }
      return { data: null, error: null };
    });
    await show();
    expect(screen.getByText("Accepted receipt recorded")).toBeInTheDocument();
    expect(screen.getByText("Receipt timestamp unavailable")).toBeInTheDocument();
  });

  it("shows checkpoint statistics with an explicit current-page denominator", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "can_manage_org") return { data: true, error: null };
      if (name === "get_event_checkpoint_coverage") {
        return { data: [acceptedRow, unrecordedRow], error: null };
      }
      return { data: null, error: null };
    });
    await show();
    expect(screen.getByRole("heading", { name: "Checkpoint statistics on this page" })).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText(/not event-wide totals/i)).toBeInTheDocument();
  });

  it("shows an empty state without interpreting it as attendance absence", async () => {
    await show();
    expect(screen.getByText("No checkpoint evidence rows are available on this page.")).toBeInTheDocument();
    expect(screen.queryByText(/\bABSENT\b/)).not.toBeInTheDocument();
  });

  it.each([
    ["42501", "unavailable for this account or event"],
    ["55000", "requires a frozen event roster"],
    ["22023", "request was invalid"],
    ["PGRST202", "Backend capability could not be found"],
  ])("handles Backend error %s without exposing database details", async (code, message) => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "can_manage_org") return { data: true, error: null };
      if (name === "get_event_checkpoint_coverage") {
        return { data: null, error: { code, message: "private database detail" } };
      }
      return { data: null, error: null };
    });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("form", { name: "Assign event Staff" })).toBeInTheDocument();
    expect(screen.queryByText("private database detail")).not.toBeInTheDocument();
  });

  it("rechecks manager authorization before refreshing existing evidence", async () => {
    let permissionChecks = 0;
    rpc.mockImplementation(async (name: string) => {
      if (name === "can_manage_org") {
        permissionChecks += 1;
        return { data: permissionChecks === 1, error: null };
      }
      if (name === "get_event_checkpoint_coverage") return { data: [acceptedRow], error: null };
      return { data: null, error: null };
    });
    await show();
    expect(screen.getByText("Accepted receipt recorded")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh checkpoint coverage" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("unavailable for this account or event"));

    expect(coverageCalls()).toHaveLength(1);
    expect(screen.getByText(/Previously loaded results remain displayed/)).toBeInTheDocument();
  });

  it("isolates network failures from the existing Operations workspace", async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === "can_manage_org") return { data: true, error: null };
      if (name === "get_event_checkpoint_coverage") throw new Error("private network detail");
      return { data: null, error: null };
    });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load checkpoint coverage");
    expect(screen.getByRole("form", { name: "Assign event Staff" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Activate event" })).toBeInTheDocument();
    expect(screen.queryByText("private network detail")).not.toBeInTheDocument();
  });

  it("refreshes only the currently displayed coverage page", async () => {
    checkpointOrder.mockResolvedValueOnce({
      data: [1, 2, 3, 4].map((number) => ({
        ...checkpoint,
        id: "cccccccc-cccc-4ccc-8ccc-" + String(number).padStart(12, "0"),
        label: "Checkpoint " + number,
        sort_order: number,
      })),
      error: null,
    });
    rosterEq.mockResolvedValueOnce({ count: 600, error: null });
    await show(ORG, EVENT, { coverage_page: "2" });
    expect(coverageCalls()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Refresh checkpoint coverage" }));
    await waitFor(() => expect(coverageCalls()).toHaveLength(2));

    expect(coverageCalls().map(([, args]) => args)).toEqual([
      { eid: EVENT, p_limit: 200, p_offset: 200 },
      { eid: EVENT, p_limit: 200, p_offset: 200 },
    ]);
    expect(eventOne).toHaveBeenCalledTimes(2);
    expect(assignmentOrder).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls.filter(([name]) => name === "can_manage_org")).toHaveLength(2);
  });
});


describe("M3.2B organizer lifecycle and finalized results", () => {
  const finalTime = "2026-12-05T04:00:00Z";
  const finalRow = {
    event_id: EVENT, student_id: "00001234", status: "PRESENT",
    required_checkpoint_count: 2, accepted_checkpoint_count: 2,
    finalized_at: finalTime, finalized_by: STAFF,
  };
  function setState(state: string) {
    eventOne.mockResolvedValue({ data: { ...entry, state, opened_at: "2026-12-04T08:00:00Z" }, error: null });
  }
  function resultCalls() {
    return rpc.mock.calls.filter(([name]) => name === "get_event_finalized_results");
  }
  function results(data: unknown, error: unknown = null) {
    rpc.mockImplementation(async (name: string) => name === "can_manage_org"
      ? { data: true, error: null }
      : name === "get_event_checkpoint_coverage" ? { data: [acceptedRow], error: null }
      : { data, error });
  }

  it("offers explicit closure with server-time prerequisite, not finalization, on OPEN", async () => {
    setState("OPEN");
    await show();
    expect(screen.getByRole("form", { name: "Close event" })).toBeInTheDocument();
    expect(screen.getByText(/Backend verifies server time/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Finalize attendance" })).not.toBeInTheDocument();
    expect(resultCalls()).toHaveLength(0);
  });

  it("offers finalization only after closure with reviewable provisional evidence", async () => {
    setState("SYNCING");
    results([]);
    await show();
    expect(screen.getByText(/not offline synchronization completion/)).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Finalize attendance" })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Close event" })).not.toBeInTheDocument();
    expect(coverageCalls()).toHaveLength(1);
    expect(resultCalls()).toHaveLength(0);
  });

  it("does not offer finalization without reviewable evidence", async () => {
    setState("SYNCING");
    await show();
    expect(screen.queryByRole("form", { name: "Finalize attendance" })).not.toBeInTheDocument();
    expect(screen.getByText(/obtain evidence for review/)).toBeInTheDocument();
  });

  it.each(["DRAFT", "LOCKED"])("does not offer closure, finalization or result reads in %s", async state => {
    setState(state);
    await show();
    expect(screen.queryByRole("form", { name: "Close event" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Finalize attendance" })).not.toBeInTheDocument();
    expect(resultCalls()).toHaveLength(0);
  });

  it("renders authoritative classifications, text IDs, counts, and audit only on FINALIZED", async () => {
    setState("FINALIZED");
    results([
      finalRow,
      { ...finalRow, student_id: "00001235", status: "INCOMPLETE", accepted_checkpoint_count: 1 },
      { ...finalRow, student_id: "00001236", status: "ABSENT", accepted_checkpoint_count: 0 },
    ]);
    rosterEq.mockResolvedValueOnce({ count: 600, error: null });
    await show(ORG, EVENT, { results_page: "2", coverage_page: "1", other: "keep" });
    expect(resultCalls()).toEqual([["get_event_finalized_results", { eid: EVENT, p_limit: 200, p_offset: 200 }]]);
    const table = screen.getByRole("table", { name: "Finalized prototype attendance results" });
    expect(within(table).getByText("00001234")).toBeInTheDocument();
    for (const status of ["PRESENT", "INCOMPLETE", "ABSENT"]) expect(within(table).getByText(status)).toBeInTheDocument();
    expect(screen.getByText("Finalized at (Asia/Manila)")).toBeInTheDocument();
    expect(screen.getByText("Finalized by (Auth UUID)")).toBeInTheDocument();
    expect(document.querySelector('time[datetime="' + finalTime + '"]')).toHaveTextContent(/12:00/);
    expect(screen.getByRole("link", { name: "Next results page" })).toHaveAttribute("href",
      "/organizations/" + ORG + "/events/" + EVENT + "/operations?coverage_page=1&other=keep&results_page=3");
    expect(screen.queryByRole("form", { name: "Finalize attendance" })).not.toBeInTheDocument();
    expect(from).not.toHaveBeenCalledWith("attendance_records");
  });

  it.each([["0", 0], ["invalid", 0], ["99999999999999999999", 0], ["100", 400]])(
    "bounds result page %s to a valid offset", async (page, offset) => {
      setState("FINALIZED");
      results([]);
      rosterEq.mockResolvedValueOnce({ count: 600, error: null });
      await show(ORG, EVENT, { results_page: page as string });
      expect(resultCalls()).toEqual([["get_event_finalized_results", { eid: EVENT, p_limit: 200, p_offset: offset }]]);
      expect(screen.getByText(/No finalized result rows were returned/)).toBeInTheDocument();
      expect(screen.queryByRole("table", { name: "Finalized prototype attendance results" })).not.toBeInTheDocument();
    },
  );

  it("denies unknown or foreign events and manager authorization failures before result reads", async () => {
    setState("FINALIZED");
    eventOne.mockResolvedValueOnce({ data: { ...entry, state: "FINALIZED", organization_id: STAFF }, error: null });
    await expect(EventOperationsPage({ params: Promise.resolve({ id: ORG, eventId: EVENT }) })).rejects.toThrow("Not found");
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await show();
    expect(resultCalls()).toHaveLength(0);
  });

  it.each(["42501", "22023", "55000", "unknown"])("shows safe finalized results error %s", async code => {
    setState("FINALIZED");
    results(null, { code, message: "private database detail" });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent(/results|finalized event/i);
    expect(screen.queryByText("private database detail")).not.toBeInTheDocument();
  });

  it("rejects malformed or mismatched result rows without rendering them", async () => {
    setState("FINALIZED");
    results([{ ...finalRow, event_id: ORG }]);
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("unexpected finalized results response");
    expect(screen.queryByRole("table", { name: "Finalized prototype attendance results" })).not.toBeInTheDocument();
  });

  it("rechecks the event association before refreshing provisional evidence", async () => {
    eventOne.mockResolvedValueOnce({ data: entry, error: null })
      .mockResolvedValueOnce({ data: { ...entry, organization_id: STAFF }, error: null });
    results([]);
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Refresh checkpoint coverage" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("unavailable for this account or event"));
    expect(coverageCalls()).toHaveLength(1);
  });
});
