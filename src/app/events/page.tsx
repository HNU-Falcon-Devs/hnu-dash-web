import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Organization = { id: string; name: string; slug: string };

export default async function EventsPage() {
  const auth = await getAuthState();
  if (auth.status === "signed-out") redirect("/login");
  if (auth.status === "denied") redirect("/login?error=access_denied");
  if (auth.status !== "authenticated") {
    return <main role="alert" className="p-8 text-center">Events are unavailable. We could not verify your account.</main>;
  }

  let organizations: Organization[] = [];
  let error = false;
  try {
    const supabase = await createClient();
    const result = await supabase.from("organizations").select("id,name,slug").order("name", { ascending: true });
    error = Boolean(result.error);
    if (!error) organizations = (result.data ?? []) as Organization[];
  } catch {
    error = true;
  }

  return (
    <AppShell userEmail={auth.email} activePath="/events">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Events</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Choose an organization to view its events. Only organizations accessible to your account appear here.
          </p>
        </div>
        <Card>
          <CardHeader><CardTitle>Your organizations</CardTitle></CardHeader>
          <CardContent>
            {error ? (
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
                Could not load organizations. <Link href="/events" className="underline">Retry</Link>
              </p>
            ) : organizations.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No organizations are available to your account.
              </p>
            ) : (
              <ul aria-label="Event organizations" className="divide-y divide-slate-200 dark:divide-slate-800">
                {organizations.map(org => (
                  <li key={org.id} className="py-4 first:pt-0 last:pb-0">
                    <Link href={`/organizations/${org.id}/events`}
                      className="font-semibold text-emerald-700 underline dark:text-emerald-400">{org.name}</Link>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{org.slug}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
