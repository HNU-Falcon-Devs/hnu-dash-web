import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const dynamic = "force-dynamic";
const errors: Record<string, string> = {
  access_denied: "Access requires a verified @hnu.edu.ph Google Workspace account.",
  oauth_failed: "Google sign-in was cancelled or could not be completed.",
  missing_code: "The sign-in response was incomplete. Please try again.",
  auth_unavailable: "The authentication service is temporarily unavailable.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error ? errors[error] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md space-y-5">
        <div className="flex justify-end"><ThemeToggle /></div>
        <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-9">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#027013] text-xl font-extrabold text-amber-300">H</span>
            <div><h1 className="text-2xl font-bold">HNU DASH</h1><p className="text-sm text-slate-500 dark:text-slate-400">Holy Name University</p></div>
          </div>
          <h2 className="mt-9 text-xl font-semibold">Sign in to HNU DASH</h2>
          <p className="mt-2 mb-6 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Use your verified institutional Google Workspace account to continue.
          </p>
          {message && <p role="alert" className="mb-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{message}</p>}
          <GoogleSignInButton />
          <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Only verified @hnu.edu.ph accounts are permitted. Application permissions are assigned separately.
          </p>
        </section>
      </div>
    </main>
  );
}
