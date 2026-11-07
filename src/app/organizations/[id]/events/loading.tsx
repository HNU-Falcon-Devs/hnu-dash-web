export default function OrganizationEventsLoading() {
  return (
    <main role="status" aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <p className="rounded-xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
        Loading organization events…
      </p>
    </main>
  );
}
