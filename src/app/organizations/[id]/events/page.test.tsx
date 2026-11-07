import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import OrganizationEventsPage from "./page";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`Redirect to ${url}`); }),
  notFound: vi.fn(() => { throw new Error("Not found"); }),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const orgOne = vi.fn();
const orgEq = vi.fn(() => ({ maybeSingle: orgOne }));
const orgSelect = vi.fn(() => ({ eq: orgEq }));
const eventOrder = vi.fn();
const eventEq = vi.fn(() => ({ order: eventOrder }));
const eventSelect = vi.fn(() => ({ eq: eventEq }));
const from = vi.fn((table: string) => table === "organizations" ? { select: orgSelect } : { select: eventSelect });
const rpc = vi.fn();

const draft = {
  id: EVENT, organization_id: ORG, title: "General Assembly",
  starts_at: "2026-12-05T01:00:00Z", ends_at: "2026-12-05T03:00:00Z",
  target_year_levels: [1, 3], state: "DRAFT", roster_frozen_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "staff@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ from, rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
  orgOne.mockResolvedValue({ data: { id: ORG, name: "COECS", slug: "coecs" }, error: null });
  eventOrder.mockResolvedValue({ data: [draft], error: null });
  rpc.mockResolvedValue({ data: false, error: null });
});

async function display(id = ORG) {
  render(<Providers>{await OrganizationEventsPage({ params: Promise.resolve({ id }) })}</Providers>);
}

describe("organization-scoped draft event page", () => {
  it("shows RLS-visible events, schedule in Manila, years and state to Staff without controls", async () => {
    await display();
    expect(from).toHaveBeenCalledWith("events");
    expect(eventSelect).toHaveBeenCalledWith("id,organization_id,title,starts_at,ends_at,target_year_levels,state,roster_frozen_at");
    expect(eventEq).toHaveBeenCalledWith("organization_id", ORG);
    expect(eventOrder).toHaveBeenCalledWith("starts_at", { ascending: true });
    expect(rpc).toHaveBeenCalledWith("can_manage_org", { org_id: ORG });
    const list = screen.getByRole("list", { name: "Organization events" });
    expect(within(list).getByText("General Assembly")).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "View checkpoints" }))
      .toHaveAttribute("href", `/organizations/${ORG}/events/${EVENT}/checkpoints`);
    expect(within(list).getByText("DRAFT")).toBeInTheDocument();
    expect(within(list).getByText("1, 3")).toBeInTheDocument();
    expect(within(list).getByText(/9:00/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Create draft event" })).not.toBeInTheDocument();
    expect(screen.queryByText("Edit draft")).not.toBeInTheDocument();
  });

  it("shows create and edit controls when Backend approves active leader or admin", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await display();
    expect(screen.getByRole("form", { name: "Create draft event" })).toBeInTheDocument();
    const edit = screen.getByRole("form", { name: "Edit draft event General Assembly" });
    expect(edit).toBeInTheDocument();
    expect(within(edit).getByLabelText("Event title")).toHaveValue("General Assembly");
    expect(within(edit).getByLabelText("Starts (Philippine time)")).toHaveValue("2026-12-05T09:00");
    expect(within(edit).getByLabelText("Ends (Philippine time)")).toHaveValue("2026-12-05T11:00");
  });

  it("hides edit controls for non-DRAFT or frozen events even for managers", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    eventOrder.mockResolvedValue({ data: [{ ...draft, state: "OPEN" }, { ...draft, id: "event-frozen", roster_frozen_at: "2026-12-01T00:00:00Z" }], error: null });
    await display();
    expect(screen.getByRole("form", { name: "Create draft event" })).toBeInTheDocument();
    expect(screen.queryByText("Edit draft")).not.toBeInTheDocument();
  });

  it("hides controls if Backend authorization RPC errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await display();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not verify event-management permissions");
    expect(screen.queryByRole("form", { name: "Create draft event" })).not.toBeInTheDocument();
    expect(screen.getByText("General Assembly")).toBeInTheDocument();
  });

  it("shows empty or failed list states without dummy records", async () => {
    eventOrder.mockResolvedValueOnce({ data: [], error: null });
    await display();
    expect(screen.getByText("No events are visible in this organization.")).toBeInTheDocument();
  });

  it("rejects missing/RLS-invisible organizations", async () => {
    orgOne.mockResolvedValue({ data: null, error: null });
    await expect(OrganizationEventsPage({ params: Promise.resolve({ id: ORG }) })).rejects.toThrow("Not found");
    expect(eventSelect).not.toHaveBeenCalled();
  });

  it("rejects malformed IDs without DB reads", async () => {
    await expect(OrganizationEventsPage({ params: Promise.resolve({ id: "invalid" }) })).rejects.toThrow("Not found");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("renders safe organization and event query errors", async () => {
    orgOne.mockResolvedValueOnce({ data: null, error: { message: "private" } });
    await display();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load this organization");
  });

  it("redirects signed-out and denied sessions before accessing events", async () => {
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "signed-out" });
    await expect(OrganizationEventsPage({ params: Promise.resolve({ id: ORG }) })).rejects.toThrow("Redirect to /login");
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "denied" });
    await expect(OrganizationEventsPage({ params: Promise.resolve({ id: ORG }) })).rejects.toThrow("Redirect to /login?error=access_denied");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("fails closed on verification outages", async () => {
    vi.mocked(getAuthState).mockResolvedValue({ status: "error" });
    await display();
    expect(screen.getByRole("alert")).toHaveTextContent("Events are unavailable");
    expect(createClient).not.toHaveBeenCalled();
  });
});
