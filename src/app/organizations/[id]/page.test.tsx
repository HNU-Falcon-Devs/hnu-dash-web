import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import OrganizationDetailsPage from "./page";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => { throw new Error(`Redirect to ${to}`); }),
  notFound: vi.fn(() => { throw new Error("Not found"); }),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const orgMaybeSingle = vi.fn();
const orgEq = vi.fn(() => ({ maybeSingle: orgMaybeSingle }));
const orgSelect = vi.fn(() => ({ eq: orgEq }));
const memberOrder = vi.fn();
const memberEq = vi.fn(() => ({ order: memberOrder }));
const memberSelect = vi.fn(() => ({ eq: memberEq }));
const from = vi.fn((name: string) => name === "organizations"
  ? { select: orgSelect } : { select: memberSelect });
const rpc = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "staff@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ from, rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
  orgMaybeSingle.mockResolvedValue({
    data: { id: ORG, name: "College Organization", slug: "college-org", active: true },
    error: null,
  });
  memberOrder.mockResolvedValue({
    data: [{ organization_id: ORG, user_id: USER, role: "leader", active: false }],
    error: null,
  });
  rpc.mockResolvedValue({ data: false, error: null });
});

async function renderPage(id = ORG) {
  render(<Providers>{await OrganizationDetailsPage({ params: Promise.resolve({ id }) })}</Providers>);
}

describe("organization details and RLS-scoped members", () => {
  it("loads a visible organization and RLS-scoped memberships, with no user lookup", async () => {
    await renderPage();
    expect(from).toHaveBeenCalledWith("organizations");
    expect(orgSelect).toHaveBeenCalledWith("id,name,slug,active");
    expect(orgEq).toHaveBeenCalledWith("id", ORG);
    expect(from).toHaveBeenCalledWith("organization_memberships");
    expect(memberSelect).toHaveBeenCalledWith("organization_id,user_id,role,active");
    expect(memberEq).toHaveBeenCalledWith("organization_id", ORG);
    expect(memberOrder).toHaveBeenCalledWith("user_id", { ascending: true });
    expect(rpc).toHaveBeenCalledWith("is_platform_admin");

    expect(screen.getByRole("heading", { name: "College Organization" })).toBeInTheDocument();
    expect(screen.getByText("college-org")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Organization memberships" });
    expect(within(list).getByText(USER)).toBeInTheDocument();
    expect(within(list).getByText("leader")).toBeInTheDocument();
    expect(within(list).getByText("Inactive")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Assign organization member" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: `Edit membership ${USER}` })).not.toBeInTheDocument();
  });

  it("shows assignment and scoped editing forms to platform administrators", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await renderPage();
    const assignForm = screen.getByRole("form", { name: "Assign organization member" });
    expect(within(assignForm).getByRole("textbox", { name: "Existing Auth user UUID" })).toBeRequired();
    expect(within(assignForm).getByText(/UUID alone does not prove/)).toBeInTheDocument();
    expect(within(assignForm).getByRole("button", { name: "Assign member" })).toBeInTheDocument();
    const editForm = screen.getByRole("form", { name: `Edit membership ${USER}` });
    expect(within(editForm).getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(within(editForm).getByLabelText("Role")).toHaveValue("leader");
    expect(within(editForm).getByLabelText("Status")).toHaveValue("false");
  });

  it("shows empty RLS-visible memberships without test fixtures", async () => {
    memberOrder.mockResolvedValue({ data: [], error: null });
    await renderPage();
    expect(screen.getByText("No memberships are visible to your account.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Organization memberships" })).not.toBeInTheDocument();
  });

  it("hides admin controls if role RPC fails, while preserving member listing", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "backend down" } });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not verify administrator permissions");
    expect(screen.queryByRole("form", { name: "Assign organization member" })).not.toBeInTheDocument();
    expect(screen.getByText(USER)).toBeInTheDocument();
  });

  it("shows a fetch error instead of an empty list when membership read fails", async () => {
    memberOrder.mockResolvedValue({ data: null, error: { message: "not allowed" } });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load memberships");
    expect(screen.queryByText("No memberships are visible to your account.")).not.toBeInTheDocument();
  });

  it("returns 404 for a missing or RLS-hidden organization", async () => {
    orgMaybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(OrganizationDetailsPage({ params: Promise.resolve({ id: ORG }) })).rejects.toThrow("Not found");
    expect(memberSelect).not.toHaveBeenCalled();
  });

  it("returns 404 for malformed organization IDs without a database request", async () => {
    await expect(OrganizationDetailsPage({ params: Promise.resolve({ id: "not-a-uuid" }) })).rejects.toThrow("Not found");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("shows a safe error if the organization query fails", async () => {
    orgMaybeSingle.mockResolvedValue({ data: null, error: { message: "internal DB error" } });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load organization details");
    expect(screen.queryByText("internal DB error")).not.toBeInTheDocument();
    expect(memberSelect).not.toHaveBeenCalled();
  });

  it("redirects signed-out and denied users before any Supabase membership query", async () => {
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "signed-out" });
    await expect(OrganizationDetailsPage({ params: Promise.resolve({ id: ORG }) })).rejects.toThrow("Redirect to /login");
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "denied" });
    await expect(OrganizationDetailsPage({ params: Promise.resolve({ id: ORG }) })).rejects.toThrow("Redirect to /login?error=access_denied");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("fails closed when HNU identity verification is unavailable", async () => {
    vi.mocked(getAuthState).mockResolvedValue({ status: "error" });
    await renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Organization details are unavailable");
    expect(createClient).not.toHaveBeenCalled();
  });
});
