import { beforeEach, describe, expect, it, vi } from "vitest";
import { importRoster, type ImportState } from "./actions";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/auth", () => ({ getAuthState: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const idle: ImportState = { status: "idle", message: "" };
const rows = [
  { student_id: "00001", full_name: "Synthetic Example", program_code: "BSIT", year_level: 2 },
  { student_id: "A-002", full_name: "Second Example", program_code: "BSIT", year_level: 4 },
];

const rpc = vi.fn();
const client = { rpc };

function fields(value: unknown = rows, confirmed = true) {
  const form = new FormData();
  form.set("rows", JSON.stringify(value));
  if (confirmed) form.set("confirm_import", "yes");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthState).mockResolvedValue({ status: "authenticated", email: "admin@hnu.edu.ph" });
  vi.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>);
  rpc.mockImplementation(async (name: string) => name === "is_platform_admin"
    ? { data: true, error: null }
    : { data: 2, error: null });
});

describe("admin-only roster import Server Action", () => {
  it("calls the approved atomic RPC with only normalized rows and returns its confirmed count", async () => {
    const result = await importRoster(idle, fields());
    expect(rpc).toHaveBeenCalledWith("is_platform_admin");
    expect(rpc).toHaveBeenCalledWith("import_students", { rows });
    expect(result).toEqual({
      status: "success", message: "Backend confirmed 2 student records imported or updated.", importedCount: 2,
    });
    expect(JSON.stringify(result)).not.toContain("Synthetic Example");
  });

  it.each(["signed-out", "denied", "error", "unconfigured"] as const)(
    "rejects %s HNU session before invoking Supabase", async status => {
      vi.mocked(getAuthState).mockResolvedValueOnce({ status });
      expect((await importRoster(idle, fields())).status).toBe("error");
      expect(createClient).not.toHaveBeenCalled();
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("rejects Leaders, Staff and students when Backend admin RPC returns false", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const result = await importRoster(idle, fields());
    expect(result.message).toContain("Only platform administrators");
    expect(rpc).not.toHaveBeenCalledWith("import_students", expect.anything());
  });

  it("fails closed when administrator verification fails or throws", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "private" } });
    expect((await importRoster(idle, fields())).message).toContain("Could not verify");
    expect(rpc).not.toHaveBeenCalledWith("import_students", expect.anything());
    rpc.mockRejectedValueOnce(new Error("backend unavailable"));
    expect((await importRoster(idle, fields())).message).toContain("Import failed");
    expect(rpc).not.toHaveBeenCalledWith("import_students", expect.anything());
  });

  it("requires server-side confirmation even for a tampered form", async () => {
    const result = await importRoster(idle, fields(rows, false));
    expect(result.message).toContain("Confirm");
    expect(rpc).not.toHaveBeenCalledWith("import_students", expect.anything());
  });

  it("blocks invalid JSON, malformed records, duplicates and batches over 1,000", async () => {
    const badJson = new FormData();
    badJson.set("confirm_import", "yes");
    badJson.set("rows", "{oops");
    expect((await importRoster(idle, badJson)).status).toBe("error");
    for (const input of [
      [],
      [{ ...rows[0], year_level: 7 }],
      [{ ...rows[0], program_code: "bsit" }],
      [rows[0], { ...rows[0] }],
      Array.from({ length: 1001 }, (_, i) => ({ ...rows[0], student_id: String(i) })),
    ]) expect((await importRoster(idle, fields(input))).status).toBe("error");
    expect(rpc).not.toHaveBeenCalledWith("import_students", expect.anything());
  });

  it("reports Backend atomic rejection without exposing SQL or claiming partial success", async () => {
    for (const code of ["22023", "23505", "23514"]) {
      rpc.mockImplementationOnce(async () => ({ data: true, error: null }));
      rpc.mockImplementationOnce(async () => ({ data: null, error: { code, message: "PRIVATE student details" } }));
      const result = await importRoster(idle, fields());
      expect(result.status).toBe("error");
      expect(result.message).toContain("No partial import");
      expect(result.message).not.toContain("PRIVATE");
    }
  });

  it("handles Backend permission denial, network failure and malformed counts safely", async () => {
    rpc.mockImplementationOnce(async () => ({ data: true, error: null }));
    rpc.mockImplementationOnce(async () => ({ data: null, error: { code: "42501", message: "sensitive" } }));
    const denied = await importRoster(idle, fields());
    expect(denied.message).toContain("Backend denied");
    expect(denied.message).not.toContain("sensitive");

    rpc.mockImplementationOnce(async () => ({ data: true, error: null }));
    rpc.mockImplementationOnce(async () => ({ data: null, error: { code: "XX000", message: "sensitive" } }));
    expect((await importRoster(idle, fields())).message).toContain("Backend did not confirm");

    rpc.mockImplementationOnce(async () => ({ data: true, error: null }));
    rpc.mockImplementationOnce(async () => ({ data: 1, error: null }));
    expect((await importRoster(idle, fields())).message).toContain("Unexpected Backend import count");
  });

  it("never accesses the protected students table directly", async () => {
    await importRoster(idle, fields());
    expect(Object.keys(client)).toEqual(["rpc"]);
  });
});
