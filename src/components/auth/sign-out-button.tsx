"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    setError(false);
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
      router.refresh();
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span role="alert" className="text-xs text-rose-600 dark:text-rose-400">Could not sign out</span>}
      <Button type="button" variant="outline" size="sm" isLoading={loading} onClick={handleSignOut}>Sign out</Button>
    </div>
  );
}
