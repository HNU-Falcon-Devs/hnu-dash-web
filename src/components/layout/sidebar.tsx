'use client';

import { cn } from '@/utils/cn';

export interface SidebarProps { className?: string; onItemClick?: () => void; onClose?: () => void; showCloseButton?: boolean }

const navigation = ['Dashboard', 'Events', 'Organizations', 'Attendance'];

export function Sidebar({ className, onItemClick, onClose, showCloseButton = false }: SidebarProps = {}) {
  return (
    <aside className={cn('sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900', className)}>
      <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/30 bg-[#027013] text-lg font-extrabold text-amber-300">H</div><div><h1 className="font-bold tracking-tight text-slate-900 dark:text-white">HNU DASH</h1><p className="text-xs text-slate-500 dark:text-slate-400">Holy Name University</p></div></div>
        {showCloseButton && <button type="button" onClick={onClose} aria-label="Close navigation menu" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">×</button>}
      </div>
      <nav aria-label="Primary navigation" className="flex-1 space-y-1 p-4">
        {navigation.map((item, index) => <a key={item} href={`#${item.toLowerCase()}`} onClick={onItemClick} aria-current={index === 0 ? 'page' : undefined} className={cn('block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors', index === 0 ? 'bg-emerald-50 text-[#027013] dark:bg-emerald-950/50 dark:text-emerald-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800')}>{item}</a>)}
      </nav>
      <p className="border-t border-slate-100 p-5 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">UI foundation only<br />Backend integration is deferred.</p>
    </aside>
  );
}
