import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthState } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await getAuthState();
  if (auth.status === "signed-out") redirect("/login");
  if (auth.status === "denied") redirect("/login?error=access_denied");

  if (auth.status !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <section role="alert" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-bold">HNU DASH is unavailable</h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {auth.status === "unconfigured"
              ? "The development authentication settings have not been configured."
              : "We could not verify your access right now. Please try again."}
          </p>
          <Link className="mt-5 inline-block text-sm font-semibold text-emerald-700 underline dark:text-emerald-400" href="/">Try again</Link>
        </section>
      </main>
    );
  }

  return <AppShell userEmail={auth.email} />;
}
