import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { getAuthState } from "@/lib/auth";
import Home from "./page";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => { throw new Error(`Redirect to ${to}`); }),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => vi.resetAllMocks());

describe("protected home page", () => {
  it("renders the existing responsive workspace only for verified users", async () => {
    vi.mocked(getAuthState).mockResolvedValue({
      status: "authenticated", email: "student@hnu.edu.ph",
    });
    render(<Providers>{await Home()}</Providers>);
    expect(screen.getByRole("heading", { level: 1, name: "HNU DASH" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "HNU DASH Web" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByText(/Other workflows are not yet implemented/)).toBeInTheDocument();
  });

  it("redirects signed-out visitors to login", async () => {
    vi.mocked(getAuthState).mockResolvedValue({ status: "signed-out" });
    await expect(Home()).rejects.toThrow("Redirect to /login");
  });

  it("rejects signed-in users who fail the Backend identity check", async () => {
    vi.mocked(getAuthState).mockResolvedValue({ status: "denied" });
    await expect(Home()).rejects.toThrow("Redirect to /login?error=access_denied");
  });

  it("shows a non-sensitive error instead of exposing the workspace when verification fails", async () => {
    vi.mocked(getAuthState).mockResolvedValue({ status: "error" });
    render(<Providers>{await Home()}</Providers>);
    expect(screen.getByRole("alert")).toHaveTextContent("could not verify your access");
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
  });
});
