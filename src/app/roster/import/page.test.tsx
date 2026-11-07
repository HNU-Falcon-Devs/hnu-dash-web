import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Providers } from "@/components/providers";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import RosterImportPage from "./page";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`Redirect to ${url}`); }),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "admin@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
  rpc.mockResolvedValue({ data: true, error: null });
});

async function show() {
  render(<Providers>{await RosterImportPage()}</Providers>);
}

describe("admin-only roster page", () => {
  it("shows file upload and readiness explanation only to platform administrators", async () => {
    await show();
    expect(rpc).toHaveBeenCalledWith("is_platform_admin");
    expect(screen.getByRole("heading", { name: "Student roster import" })).toBeInTheDocument();
    expect(screen.getByLabelText("Student roster CSV")).toBeInTheDocument();
    expect(screen.getByText(/active BSIT students/)).toBeInTheDocument();
    expect(screen.getByText(/No eligibility counts are inferred/)).toBeInTheDocument();
    expect(screen.queryByText("Import confirmed")).not.toBeInTheDocument();
  });

  it("shows access denied without upload controls to non-admin Leaders, Staff or students", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Only platform administrators");
    expect(screen.queryByLabelText("Student roster CSV")).not.toBeInTheDocument();
  });

  it("hides import controls on role RPC failure", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "private" } });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not verify administrator access");
    expect(screen.queryByLabelText("Student roster CSV")).not.toBeInTheDocument();
    expect(screen.queryByText("private")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated/denied users before role lookups", async () => {
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "signed-out" });
    await expect(RosterImportPage()).rejects.toThrow("Redirect to /login");
    vi.mocked(getAuthState).mockResolvedValueOnce({ status: "denied" });
    await expect(RosterImportPage()).rejects.toThrow("Redirect to /login?error=access_denied");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("fails closed if identity verification is unavailable", async () => {
    vi.mocked(getAuthState).mockResolvedValue({ status: "error" });
    await show();
    expect(screen.getByRole("alert")).toHaveTextContent("Roster import unavailable");
    expect(createClient).not.toHaveBeenCalled();
  });
});
