"use server";

import { revalidatePath } from "next/cache";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type CreateOrganizationState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: { name?: string; slug?: string };
};

export async function createOrganization(
  _previous: CreateOrganizationState,
  formData: FormData
): Promise<CreateOrganizationState> {
  const rawName = formData.get("name");
  const rawSlug = formData.get("slug");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const slug = typeof rawSlug === "string" ? rawSlug.trim() : "";

  const fieldErrors: NonNullable<CreateOrganizationState["fieldErrors"]> = {};
  if (name.length < 2 || name.length > 160) {
    fieldErrors.name = "Name must be between 2 and 160 characters.";
  }
  if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
    fieldErrors.slug = "Use 2–64 lowercase letters, numbers, or hyphens.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Review the highlighted fields.", fieldErrors };
  }

  try {
    // Never authorize a mutation based only on whether the form was displayed.
    const auth = await getAuthState();
    if (auth.status !== "authenticated") {
      return { status: "error", message: "Your session is not authorized. Please sign in again." };
    }

    const supabase = await createClient();
    const { data: isAdmin, error: roleError } = await supabase.rpc("is_platform_admin");
    if (roleError) {
      return { status: "error", message: "Could not verify your permissions. Please retry." };
    }
    if (isAdmin !== true) {
      return { status: "error", message: "Only platform administrators can create organizations." };
    }

    // RLS independently enforces is_platform_admin(); id/active remain DB defaults.
    const { error } = await supabase.from("organizations").insert({ name, slug });
    if (error) {
      if (error.code === "23505") {
        return { status: "error", message: "That organization slug is already in use.", fieldErrors: { slug: "Choose a unique slug." } };
      }
      if (error.code === "23514") {
        return { status: "error", message: "The organization details do not meet the required format." };
      }
      return { status: "error", message: "Organization could not be created. Please retry." };
    }

    revalidatePath("/organizations");
    return { status: "success", message: `Organization “${name}” created successfully.` };
  } catch {
    return { status: "error", message: "Organization could not be created. Please retry." };
  }
}
