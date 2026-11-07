"use server";

import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MAX_CSV_BYTES, validateRosterRows } from "./roster-csv";

export type ImportState = {
  status: "idle" | "success" | "error";
  message: string;
  importedCount?: number;
};

export async function importRoster(
  _previous: ImportState, formData: FormData,
): Promise<ImportState> {
  try {
    // Recheck at submission time. The database RPC independently enforces admin access.
    const auth = await getAuthState();
    if (auth.status !== "authenticated") {
      return { status: "error", message: "Your verified HNU session is not authorized. Sign in again." };
    }
    const supabase = await createClient();
    const { data: isAdmin, error: roleError } = await supabase.rpc("is_platform_admin");
    if (roleError) {
      return { status: "error", message: "Could not verify administrator permissions. Try again." };
    }
    if (isAdmin !== true) {
      return { status: "error", message: "Only platform administrators can import students." };
    }
    if (formData.get("confirm_import") !== "yes") {
      return { status: "error", message: "Confirm that the preview is correct before importing." };
    }

    const serialized = formData.get("rows");
    if (typeof serialized !== "string" || serialized.length > MAX_CSV_BYTES) {
      return { status: "error", message: "Invalid or oversized roster submission." };
    }

    let decoded: unknown;
    try { decoded = JSON.parse(serialized); }
    catch { return { status: "error", message: "Invalid roster submission." }; }
    const validation = validateRosterRows(decoded);
    if (validation.errors.length) {
      return { status: "error", message: "Roster validation failed. Correct the CSV and preview it again." };
    }

    const { data, error } = await supabase.rpc("import_students", { rows: validation.rows });
    if (error) {
      if (error.code === "42501") {
        return { status: "error", message: "The Backend denied this import. Check administrator access." };
      }
      if (error.code === "22023" || error.code === "23505" || error.code === "23514") {
        return { status: "error", message: "The Backend rejected the roster batch. No partial import was committed." };
      }
      return { status: "error", message: "Import failed. The Backend did not confirm any imported records." };
    }
    if (typeof data !== "number" || !Number.isInteger(data) ||
        data !== validation.rows.length) {
      return { status: "error", message: "Unexpected Backend import count. Verify the result with an administrator." };
    }

    return { status: "success", message: `Backend confirmed ${data} student records imported or updated.`,
      importedCount: data };
  } catch {
    return { status: "error", message: "Import failed. Please try again." };
  }
}
