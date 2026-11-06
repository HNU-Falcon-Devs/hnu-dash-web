export default function Loading() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
    >
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent dark:border-emerald-400 dark:border-t-transparent" />
        <p className="text-sm font-medium">Checking your HNU DASH session…</p>
      </div>
    </main>
  );
}
