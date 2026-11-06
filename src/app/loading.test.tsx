import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Loading from "./loading";

describe("protected workspace loading", () => {
  it("shows an accessible session-checking state", () => {
    render(<Loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking your HNU DASH session");
  });
});
