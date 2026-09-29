'use client';

import React from 'react';
import { cn } from '@/utils/cn';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none';

    const variants = {
      primary:
        'bg-[#027013] text-white hover:bg-[#01540e] active:bg-[#01400b] focus-visible:ring-[#027013] dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus-visible:ring-emerald-500 shadow-xs',
      secondary:
        'bg-slate-100 text-slate-900 hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
      outline:
        'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 shadow-2xs',
      ghost:
        'text-slate-700 hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-slate-400 dark:text-slate-300 dark:hover:bg-slate-800',
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus-visible:ring-rose-500 dark:bg-rose-700 dark:hover:bg-rose-800 shadow-xs',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
