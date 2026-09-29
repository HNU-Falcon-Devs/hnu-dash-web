import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Providers } from "@/components/providers";
import Home from "./page";

describe("Home Page & AppShell", () => {
  it("renders HNU DASH branding and the Student Portal by default", () => {
    render(
      <Providers>
        <Home />
      </Providers>
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "HNU DASH" })
    ).toBeInTheDocument();
    expect(screen.getByText("Your Organizations:")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Events (All Organizations)")).toBeInTheDocument();
    expect(screen.getAllByText(/Juan Dela Cruz/i).length).toBeGreaterThanOrEqual(1);
  });

  it("switches to organization workspace when an organization is clicked in the sidebar", () => {
    render(
      <Providers>
        <Home />
      </Providers>
    );

    // Find and click CCS Council in "Your Organizations:"
    const ccsButton = screen.getByRole("button", {
      name: /College of Computer Studies Student Council/i,
    });
    fireEvent.click(ccsButton);

    // Active organization view should now be displayed
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "College of Computer Studies Student Council",
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Full Organization Administrative Access/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Event/i })).toBeInTheDocument();
  });
});
