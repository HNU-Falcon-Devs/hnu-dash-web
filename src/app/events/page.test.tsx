import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import EventsPage from "./page";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`Redirect to ${url}`); }),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const order = vi.fn();
const select = vi.fn(() => ({ order }));
const from = vi.fn(() => ({ select }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "staff@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>);
  order.mockResolvedValue({ data: [{ id: "org-1", name: "COECS", slug: "coecs" }], error: null });
});

async function show() { render(<Providers>{await EventsPage()}</Providers>); }

describe("events organization picker", () => {
  it("lists only RLS-visible organizations and real per-organization links", async () => {
    await show();
    expect(from).toHaveBeenCalledWith("organizations");
    expect(select).toHaveBeenCalledWith("id,name,slug");
    expect(order).toHaveBeenCalledWith("name", { ascending: true });
    expect(screen.getByRole("link", { name: "COECS" })).toHaveAttribute("href", "/organizations/org-1/events");
    expect(screen.getByRole("navigation", { name: "Primary navigation" }).querySelector('[aria-current="page"]')).toHaveAttribute("href", "/events");
  });

  it("shows the real empty state and read failures", async () => {
    order.mockResolvedValueOnce({ data: [], error: null });
    await show();
    expect(screen.getByText("No organizations are available to your account.")).toBeInTheDocument();
  });

  it("redirects unverified sessions and fails closed on errors", async () => {
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "signed-out" });
    await expect(EventsPage()).rejects.toThrow("Redirect to /login");
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "denied" });
    await expect(EventsPage()).rejects.toThrow("Redirect to /login?error=access_denied");
    vi.mocked(getAuthState).mockResolvedValue({ status: "error" });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Events are unavailable");
    expect(createClient).not.toHaveBeenCalled();
  });
});
