import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MembershipsLoading from "./loading";

describe("membership route loading", () => {
  it("shows an accessible loading state", () => {
    render(<MembershipsLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading organization memberships");
  });
});
