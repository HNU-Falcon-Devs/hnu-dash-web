import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { closeEvent, finalizeEvent, type OperationState } from "./actions";
import { describe, expect, it, vi } from "vitest";
import {
  AssignEventStaffForm, RevokeEventStaffForm, OpenEventForm, EventLifecycleForm,
} from "./operation-forms";

vi.mock("./actions", () => ({
  assignEventStaff: vi.fn(),
  revokeEventStaff: vi.fn(),
  activateEvent: vi.fn(),
  closeEvent: vi.fn(),
  finalizeEvent: vi.fn(),
}));

const ORG = "11111111-1111-4111-8111-111111111111";
const EVENT = "22222222-2222-4222-8222-222222222222";
const STAFF = "33333333-3333-4333-8333-333333333333";
const ASSIGNMENT = "44444444-4444-4444-8444-444444444444";

describe("event operations forms", () => {
  it("uses only active membership UUID candidates without user lookup", () => {
    render(<AssignEventStaffForm organizationId={ORG} eventId={EVENT}
      candidates={[{ user_id: STAFF }]} />);
    const form = screen.getByRole("form", { name: "Assign event Staff" });
    expect(within(form).getByRole("combobox", { name: "Assign active organization Staff" })).toHaveValue("");
    expect(within(form).getByRole("option", { name: STAFF })).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Assign to event" })).toBeInTheDocument();
    expect(form).not.toHaveTextContent("Email address");
  });

  it("requires deliberate confirmation before revoking an assigned Staff account", () => {
    render(<RevokeEventStaffForm organizationId={ORG} eventId={EVENT}
      assignmentId={ASSIGNMENT} staffId={STAFF} />);
    const form = screen.getByRole("form", { name: "Revoke Staff assignment " + STAFF });
    const checkbox = within(form).getByRole("checkbox", { name: /Confirm revocation/ });
    expect(checkbox).toBeRequired();
    expect(within(form).getByRole("button", { name: "Revoke assignment" })).toBeInTheDocument();
    expect(within(form).getByText(/stops new authorized online access/)).toBeInTheDocument();
  });

  it("requires confirmation and explains activation does not freeze or start attendance", () => {
    render(<OpenEventForm organizationId={ORG} eventId={EVENT} />);
    const form = screen.getByRole("form", { name: "Activate event" });
    const checkbox = within(form).getByRole("checkbox", { name: /verified the roster and checkpoint/ });
    expect(checkbox).toBeRequired();
    expect(within(form).getByRole("button", { name: "Activate DRAFT event" })).toBeInTheDocument();
    expect(within(form).getByText(/does not start scanning/)).toBeInTheDocument();
  });
});


describe("explicit lifecycle confirmation", () => {
  it.each(["close", "finalize"] as const)("requires deliberate confirmation and supports cancel for %s", kind => {
    const action = kind === "close" ? closeEvent : finalizeEvent;
    vi.mocked(action).mockClear();
    render(<EventLifecycleForm organizationId={ORG} eventId={EVENT} kind={kind} />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeRequired();
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Cancel confirmation" }));
    expect(checkbox).not.toBeChecked();
    expect(action).not.toHaveBeenCalled();
  });

  it("disables resubmission while pending and requires reload after an ambiguous outcome", async () => {
    let resolve!: (state: OperationState) => void;
    vi.mocked(closeEvent).mockReset().mockImplementation(() =>
      new Promise<OperationState>(done => { resolve = done; }));
    render(<EventLifecycleForm organizationId={ORG} eventId={EVENT} kind="close" />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("form", { name: "Close event" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Cancel confirmation" })).toBeDisabled();
    expect(closeEvent).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ status: "error", message: "Reload to verify event state.", reloadRequired: true }));
    expect(screen.getByRole("alert")).toHaveTextContent("Reload to verify");
    expect(screen.getByRole("button", { name: "Reload event state" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close event" })).not.toBeInTheDocument();
    expect(closeEvent).toHaveBeenCalledTimes(1);
  });
});
