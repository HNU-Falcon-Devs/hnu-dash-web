import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OrganizationEventsLoading from "./loading";

describe("organization events route loading", () => {
  it("announces the loading state", () => {
    render(<OrganizationEventsLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading organization events");
  });
});
