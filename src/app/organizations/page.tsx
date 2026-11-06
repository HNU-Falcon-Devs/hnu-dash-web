import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrganizationForm } from "./organization-form";

export const dynamic = "force-dynamic";

type Organization = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
};

export default async function OrganizationsPage() {
  const auth = await getAuthState();
  if (auth.status === "signed-out") redirect("/login");
  if (auth.status === "denied") redirect("/login?error=access_denied");

  if (auth.status !== "authenticated") {
    return (
      <main role="alert" className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
        <section className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
          <h1 className="text-xl font-semibold">Organizations unavailable</h1>
          <p className="mt-2 text-sm">We could not verify your account. Please try again.</p>
          <Link className="mt-4 inline-block text-sm font-medium text-emerald-700 underline dark:text-emerald-400" href="/organizations">Retry</Link>
        </section>
      </main>
    );
  }

  let organizations: Organization[] = [];
  let listError = false;
  let isAdmin = false;
  let roleError = false;

  try {
    const supabase = await createClient();
    const [orgResult, adminResult] = await Promise.all([
      supabase.from("organizations").select("id,name,slug,active").order("name", { ascending: true }),
      supabase.rpc("is_platform_admin"),
    ]);

    listError = Boolean(orgResult.error);
    if (!listError) organizations = (orgResult.data ?? []) as Organization[];
    roleError = Boolean(adminResult.error);
    isAdmin = !roleError && adminResult.data === true;
  } catch {
    listError = true;
    roleError = true;
  }

  return (
    <AppShell userEmail={auth.email} activePath="/organizations">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Organizations</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Organizations visible to your account. Access is controlled by HNU DASH.
          </p>
        </div>
        <div className={isAdmin ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.85fr)]" : "space-y-6"}>
          <Card>
            <CardHeader>
              <CardTitle>Organization directory</CardTitle>
            </CardHeader>
            <CardContent>
              {listError ? (
                <div role="alert" className="space-y-2">
                  <p className="text-sm text-rose-700 dark:text-rose-400">Could not load organizations. Please retry.</p>
                  <Link href="/organizations" className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400">Retry</Link>
                </div>
              ) : organizations.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">No organizations are available to your account.</p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800" aria-label="Organizations">
                  {organizations.map((organization) => (
                    <li key={organization.id} className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-semibold break-words">{organization.name}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 break-all">{organization.slug}</p>
                      </div>
                      <Badge variant={organization.active ? "success" : "default"}>
                        {organization.active ? "Active" : "Inactive"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          {isAdmin && (
            <Card>
              <CardHeader><CardTitle>Create organization</CardTitle></CardHeader>
              <CardContent><OrganizationForm /></CardContent>
            </Card>
          )}
        </div>
        {roleError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
          Administrator permissions could not be checked. Organization creation is unavailable.
        </p>}
      </div>
    </AppShell>
  );
}
