import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AssignMembershipForm, MembershipEditor } from "./membership-forms";
import { isUuid } from "./validation";

export const dynamic = "force-dynamic";

type Organization = { id: string; name: string; slug: string; active: boolean };
type Membership = {
  organization_id: string;
  user_id: string;
  role: "leader" | "staff";
  active: boolean;
};

export default async function OrganizationDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const auth = await getAuthState();
  if (auth.status === "signed-out") redirect("/login");
  if (auth.status === "denied") redirect("/login?error=access_denied");
  if (auth.status !== "authenticated") {
    return (
      <main role="alert" className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <p>Organization details are unavailable. Please try again.</p>
      </main>
    );
  }

  let organization: Organization | null = null;
  let memberships: Membership[] = [];
  let organizationError = false;
  let membershipError = false;
  let permissionError = false;
  let isAdmin = false;

  try {
    const supabase = await createClient();
    const org = await supabase.from("organizations")
      .select("id,name,slug,active")
      .eq("id", id)
      .maybeSingle();

    organizationError = Boolean(org.error);
    if (!organizationError && org.data) {
      organization = org.data as Organization;

      const [members, admin] = await Promise.all([
        supabase.from("organization_memberships")
          .select("organization_id,user_id,role,active")
          .eq("organization_id", id)
          .order("user_id", { ascending: true }),
        supabase.rpc("is_platform_admin"),
      ]);
      membershipError = Boolean(members.error);
      if (!membershipError) memberships = (members.data ?? []) as Membership[];
      permissionError = Boolean(admin.error);
      isAdmin = !permissionError && admin.data === true;
    }
  } catch {
    organizationError = true;
  }

  if (!organizationError && !organization) notFound();

  return (
    <AppShell userEmail={auth.email} activePath="/organizations">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link href="/organizations" className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400">
          All organizations
        </Link>
        {organizationError || !organization ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-white p-6 text-sm text-rose-700 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400">
            Could not load organization details. <Link href={`/organizations/${id}`} className="underline">Retry</Link>
          </div>
        ) : (
          <>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{organization.name}</h2>
                <Badge variant={organization.active ? "success" : "default"}>
                  {organization.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 break-all">{organization.slug}</p>
            </div>
            <div className={isAdmin ? "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.85fr)]" : "space-y-6"}>
              <Card>
                <CardHeader><CardTitle>Members</CardTitle></CardHeader>
                <CardContent>
                  {membershipError ? (
                    <div role="alert" className="space-y-2 text-sm text-rose-700 dark:text-rose-400">
                      Could not load memberships. <Link href={`/organizations/${id}`} className="underline">Retry</Link>
                    </div>
                  ) : memberships.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">No memberships are visible to your account.</p>
                  ) : (
                    <ul aria-label="Organization memberships" className="divide-y divide-slate-200 dark:divide-slate-800">
                      {memberships.map((membership) => (
                        <li key={membership.user_id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 space-y-1">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Auth user UUID</p>
                              <p className="break-all font-mono text-sm">{membership.user_id}</p>
                              <p className="text-sm capitalize">{membership.role}</p>
                            </div>
                            <Badge variant={membership.active ? "success" : "default"}>
                              {membership.active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          {isAdmin && <MembershipEditor organizationId={id} userId={membership.user_id}
                            role={membership.role} active={membership.active} />}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
              {isAdmin && (
                <Card>
                  <CardHeader><CardTitle>Assign member</CardTitle></CardHeader>
                  <CardContent><AssignMembershipForm organizationId={id} /></CardContent>
                </Card>
              )}
            </div>
            {permissionError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
              Could not verify administrator permissions. Membership changes are unavailable.
            </p>}
          </>
        )}
      </div>
    </AppShell>
  );
}
