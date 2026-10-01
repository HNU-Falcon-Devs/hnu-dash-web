import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'outline';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function Badge({ className, variant = 'default', size = 'sm', dot = false, children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    primary: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    warning: 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
    outline: 'bg-transparent text-slate-700 border-slate-300 dark:text-slate-300 dark:border-slate-700',
  };
  const sizes = { sm: 'text-xs px-2.5 py-0.5 gap-1.5', md: 'text-sm px-3 py-1 gap-2' };
  const dotColors = { default: 'bg-slate-400', primary: 'bg-emerald-600', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-rose-500', outline: 'bg-slate-500' };

  return (
    <span className={cn('inline-flex items-center rounded-full border font-medium transition-colors select-none', variants[variant], sizes[size], className)} {...props}>
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotColors[variant])} aria-hidden="true" />}
      {children}
    </span>
  );
}
