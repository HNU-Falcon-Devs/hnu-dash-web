import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function redirectTo(request: Request, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.has("error")) return redirectTo(request, "/login?error=oauth_failed");
  const code = params.get("code");
  if (!code) return redirectTo(request, "/login?error=missing_code");
  if (!isSupabaseConfigured()) return redirectTo(request, "/login?error=auth_unavailable");

  try {
    const supabase = await createClient();
    const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
    if (codeError) return redirectTo(request, "/login?error=oauth_failed");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return redirectTo(request, "/login?error=oauth_failed");
    const { data: verified, error: verificationError } = await supabase.rpc("hnu_verified_user");
    if (verificationError) return redirectTo(request, "/login?error=auth_unavailable");
    if (verified !== true) {
      await supabase.auth.signOut();
      return redirectTo(request, "/login?error=access_denied");
    }
    return redirectTo(request, "/");
  } catch {
    return redirectTo(request, "/login?error=auth_unavailable");
  }
}
