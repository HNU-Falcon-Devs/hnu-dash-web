import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { GoogleSignInButton } from "./google-sign-in-button";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
const signInWithOAuth = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createClient).mockReturnValue({
    auth: { signInWithOAuth },
  } as unknown as ReturnType<typeof createClient>);
  signInWithOAuth.mockResolvedValue({ error: null });
});

describe("Google sign-in", () => {
  it("initiates Google OAuth with a local callback; domain hint is not authorization", async () => {
    render(<GoogleSignInButton />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { hd: "hnu.edu.ph" },
      },
    }));
  });

  it("displays a recoverable error when provider login cannot start", async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: "provider error" } });
    render(<GoogleSignInButton />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not start");
    expect(screen.getByRole("button", { name: "Continue with Google" })).not.toBeDisabled();
  });
});
