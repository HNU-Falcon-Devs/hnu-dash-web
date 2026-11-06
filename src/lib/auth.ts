import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AuthState =
  | { status: "unconfigured" | "signed-out" | "denied" | "error" }
  | { status: "authenticated"; email: string };

/** Database verification uses auth.users, not user-controlled metadata. */
export async function getAuthState(): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { status: "signed-out" };
    const { data: verified, error: verificationError } = await supabase.rpc("hnu_verified_user");
    if (verificationError) return { status: "error" };
    if (verified !== true) return { status: "denied" };
    return { status: "authenticated", email: user.email ?? "" };
  } catch {
    return { status: "error" };
  }
}
