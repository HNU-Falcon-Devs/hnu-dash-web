import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("identifies HNU DASH as the web management application", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "HNU DASH" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Web management application")).toBeVisible();
    expect(
      screen.getByText(/event and attendance workflows will be introduced/i),
    ).toBeVisible();
  });
});
