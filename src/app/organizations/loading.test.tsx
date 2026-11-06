import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OrganizationsLoading from "./loading";

describe("organizations route loading", () => {
  it("announces that the organizations page is loading", () => {
    render(<OrganizationsLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading organizations");
  });
});
