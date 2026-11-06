import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { SignOutButton } from "./sign-out-button";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const signOut = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createClient).mockReturnValue({ auth: { signOut } } as unknown as ReturnType<typeof createClient>);
  signOut.mockResolvedValue({ error: null });
});

describe("sign out", () => {
  it("clears the Supabase session before navigating to sign in", async () => {
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"));
    expect(signOut).toHaveBeenCalledOnce();
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("preserves the page and reports errors if session revocation fails", async () => {
    signOut.mockResolvedValue({ error: { message: "network error" } });
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not sign out");
    expect(router.replace).not.toHaveBeenCalled();
  });
});
