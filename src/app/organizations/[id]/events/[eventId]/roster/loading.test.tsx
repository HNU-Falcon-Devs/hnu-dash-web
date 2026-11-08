import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EventRosterLoading from "./loading";

it("announces loading without student details", () => {
  render(<EventRosterLoading />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading event roster");
});
