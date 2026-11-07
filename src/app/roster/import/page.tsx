import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthState } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RosterImportForm } from "./roster-import-form";

export const dynamic = "force-dynamic";

export default async function RosterImportPage() {
  const auth = await getAuthState();
  if (auth.status === "signed-out") redirect("/login");
  if (auth.status === "denied") redirect("/login?error=access_denied");
  if (auth.status !== "authenticated") {
    return <main role="alert" className="p-8 text-center">Roster import unavailable. We could not verify your HNU account.</main>;
  }

  let authorized = false;
  let roleError = false;
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("is_platform_admin");
    roleError = Boolean(error);
    authorized = !roleError && data === true;
  } catch {
    roleError = true;
  }

  return (
    <AppShell userEmail={auth.email} activePath="/organizations">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/organizations" className="text-sm font-medium text-emerald-700 underline dark:text-emerald-400">
          Back to organizations
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Student roster import</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Platform administrator workflow for preparing student records.
          </p>
        </div>
        {!authorized ? (
          <Card>
            <CardContent className="pt-6">
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
                {roleError ? "Could not verify administrator access. Please retry." :
                  "Only platform administrators can import student records."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle>Upload, validate, and preview CSV</CardTitle></CardHeader>
              <CardContent><RosterImportForm /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Roster readiness</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Imported student records provide the source for future event roster snapshots.
                  When a roster is frozen, the Backend selects <strong>active BSIT students</strong> in the
                  event&apos;s selected target year levels. Before that step, administrators must verify
                  roster accuracy and completeness; event managers must finish the draft event schedule
                  and configure at least one valid checkpoint. Freezing is not available in this workflow.
                  No eligibility counts are inferred here.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
