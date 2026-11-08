import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FreezeRosterForm } from "./freeze-form";

vi.mock("./actions", () => ({ freezeEventRoster: vi.fn() }));

it("requires explicit irreversible confirmation and explains no unfreeze or publication", () => {
  render(<FreezeRosterForm organizationId="org-id" eventId="event-id" />);
  const form = screen.getByRole("form", { name: "Freeze event roster" });
  expect(within(form).getByRole("checkbox", { name: /cannot be undone/ })).toBeRequired();
  expect(within(form).getByRole("button", { name: "Freeze roster permanently" })).toBeInTheDocument();
  expect(within(form).getByText(/no unfreeze/)).toBeInTheDocument();
  expect(within(form).getByText(/does not publish/)).toBeInTheDocument();
});
