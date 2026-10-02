'use client';

import { ThemeToggle } from '@/components/ui/theme-toggle';

export interface HeaderProps { onMenuClick?: () => void }

export function Header({ onMenuClick }: HeaderProps = {}) {
  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onMenuClick} aria-label="Open navigation menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Web foundation</p><p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">Frontend workspace</p></div>
      </div>
      <ThemeToggle />
    </header>
  );
}
