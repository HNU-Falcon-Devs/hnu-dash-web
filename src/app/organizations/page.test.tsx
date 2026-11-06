import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import OrganizationsPage from "./page";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => { throw new Error(`Redirect to ${to}`); }),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const order = vi.fn();
const select = vi.fn(() => ({ order }));
const from = vi.fn(() => ({ select }));
const rpc = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({
    status: "authenticated", email: "member@hnu.edu.ph",
  });
  vi.mocked(createClient).mockResolvedValue({
    from, rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  order.mockResolvedValue({
    data: [{ id: "org-1", name: "COECS", slug: "coecs", active: true },
      { id: "org-2", name: "Inactive Organization", slug: "inactive-org", active: false }],
    error: null,
  });
  rpc.mockResolvedValue({ data: false, error: null });
});

async function showPage() {
  render(<Providers>{await OrganizationsPage()}</Providers>);
}

describe("protected organizations directory", () => {
  it("uses the authenticated RLS-scoped query and hides admin-only actions from members", async () => {
    await showPage();
    expect(from).toHaveBeenCalledWith("organizations");
    expect(select).toHaveBeenCalledWith("id,name,slug,active");
    expect(order).toHaveBeenCalledWith("name", { ascending: true });
    expect(rpc).toHaveBeenCalledWith("is_platform_admin");

    const list = screen.getByRole("list", { name: "Organizations" });
    expect(within(list).getByText("COECS")).toBeInTheDocument();
    expect(within(list).getByText("coecs")).toBeInTheDocument();
    expect(within(list).getByText("Active")).toBeInTheDocument();
    expect(within(list).getByText("Inactive")).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Create organization" })).not.toBeInTheDocument();

    const nav = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(nav).getByRole("link", { name: "Organizations" })).toHaveAttribute("href", "/organizations");
    expect(within(nav).getByRole("link", { name: "Organizations" })).toHaveAttribute("aria-current", "page");
  });

  it("allows verified platform admins to see the create form", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await showPage();
    expect(screen.getByRole("form", { name: "Create organization" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create organization" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeRequired();
    expect(screen.getByRole("textbox", { name: "Slug" })).toBeRequired();
  });

  it("shows a real empty state without fabricating records", async () => {
    order.mockResolvedValue({ data: [], error: null });
    await showPage();
    expect(screen.getByText("No organizations are available to your account.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Organizations" })).not.toBeInTheDocument();
  });

  it("shows a query failure rather than an empty organization list", async () => {
    order.mockResolvedValue({ data: null, error: { message: "denied" } });
    await showPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load organizations");
    expect(screen.queryByText("No organizations are available to your account.")).not.toBeInTheDocument();
  });

  it("fails closed if administrator status cannot be retrieved", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "network error" } });
    await showPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Administrator permissions could not be checked");
    expect(screen.queryByRole("form", { name: "Create organization" })).not.toBeInTheDocument();
  });

  it("redirects signed-out and denied identities before touching organization data", async () => {
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "signed-out" });
    await expect(OrganizationsPage()).rejects.toThrow("Redirect to /login");
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "denied" });
    await expect(OrganizationsPage()).rejects.toThrow("Redirect to /login?error=access_denied");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("shows a safe unavailable state when authentication cannot be verified", async () => {
    vi.mocked(getAuthState).mockResolvedValue({ status: "error" });
    await showPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Organizations unavailable");
    expect(createClient).not.toHaveBeenCalled();
  });
});
