"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    setError(false);
    try {
      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { hd: "hnu.edu.ph" },
        },
      });
      if (oauthError) setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" size="lg" className="w-full" isLoading={loading} onClick={handleSignIn}>
        Continue with Google
      </Button>
      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
        Google sign-in could not start. Please try again.
      </p>}
    </div>
  );
}
