import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RosterImportLoading from "./loading";

describe("roster import loading", () => {
  it("announces loading without displaying roster content", () => {
    render(<RosterImportLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading roster import");
  });
});
