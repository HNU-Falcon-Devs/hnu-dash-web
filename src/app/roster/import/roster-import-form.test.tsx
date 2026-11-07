import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RosterImportForm } from "./roster-import-form";

vi.mock("./actions", () => ({ importRoster: vi.fn() }));

const header = "student_id,full_name,program_code,year_level";
function csvFile(contents: string, fileName = "synthetic.csv") {
  const file = new File([contents], fileName, { type: "text/csv" });
  Object.defineProperty(file, "text", { value: vi.fn().mockResolvedValue(contents) });
  return file;
}

describe("CSV import preview and confirmation UX", () => {
  it("previews quoted CSV data with leading-zero IDs and requires explicit confirmation", async () => {
    render(<RosterImportForm />);
    expect(screen.queryByRole("form", { name: "Confirm roster import" })).not.toBeInTheDocument();
    const input = screen.getByLabelText("Student roster CSV");
    fireEvent.change(input, { target: { files: [csvFile(header + '\n00001,"Example, Person",BSIT,2')] } });
    await waitFor(() => expect(screen.getByText(/1 valid records/)).toBeInTheDocument());
    const table = screen.getByRole("table");
    expect(within(table).getByText("00001")).toBeInTheDocument();
    expect(within(table).getByText("Example, Person")).toBeInTheDocument();
    const form = screen.getByRole("form", { name: "Confirm roster import" });
    expect(within(form).getByRole("checkbox", { name: /authorize importing or updating/ })).toBeRequired();
    expect(within(form).getByRole("button", { name: "Import 1 records" })).toBeInTheDocument();
    expect(within(form).getByText(/updates that student/)).toBeInTheDocument();
  });

  it("blocks the submission form for malformed CSV and shows validation errors", async () => {
    render(<RosterImportForm />);
    fireEvent.change(screen.getByLabelText("Student roster CSV"),
      { target: { files: [csvFile(header + "\n00001,Example Person,bsit,2")] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("program code"));
    expect(screen.getByText(/0 valid records/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Confirm roster import" })).not.toBeInTheDocument();
  });

  it("removes old preview and confirmation when a different file is selected", async () => {
    render(<RosterImportForm />);
    const input = screen.getByLabelText("Student roster CSV");
    fireEvent.change(input, { target: { files: [csvFile(header + "\n00001,Example Person,BSIT,2")] } });
    await waitFor(() => expect(screen.getByRole("form", { name: "Confirm roster import" })).toBeInTheDocument());
    fireEvent.change(input, { target: { files: [csvFile(header + "\n00002,Other Person,BSIT,7", "invalid.csv")] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("year level"));
    expect(screen.queryByRole("form", { name: "Confirm roster import" })).not.toBeInTheDocument();
    expect(screen.queryByText("00001")).not.toBeInTheDocument();
  });
});
