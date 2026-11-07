import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EventsLoading from "./loading";

describe("events route loading", () => {
  it("announces the loading state", () => {
    render(<EventsLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading events");
  });
});
