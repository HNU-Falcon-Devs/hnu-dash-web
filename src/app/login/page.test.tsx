import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Providers } from "@/components/providers";
import LoginPage from "./page";

describe("login page", () => {
  it("offers Google sign-in without a password form", async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({}) });
    render(<Providers>{page}</Providers>);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("shows a safe access-denied error without reflecting arbitrary query text", async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({ error: "access_denied" }) });
    render(<Providers>{page}</Providers>);
    expect(screen.getByRole("alert")).toHaveTextContent("verified @hnu.edu.ph");
  });
});
