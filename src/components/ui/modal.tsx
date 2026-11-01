'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface ModalProps { isOpen: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; className?: string; maxWidth?: 'sm' | 'md' | 'lg' | 'xl' }

const focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ isOpen, onClose, title, description, children, className, maxWidth = 'md' }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const surface = surfaceRef.current;
    (surface?.querySelector<HTMLElement>(focusableSelector) ?? surface)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !surface) return;
      const focusable = Array.from(surface.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) { event.preventDefault(); surface.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const maxWidthClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />
      <div ref={surfaceRef} tabIndex={-1} className={cn('relative z-10 w-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100', maxWidthClasses[maxWidth], className)}>
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div><h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>{description && <p id={descriptionId} className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}</div>
          <button onClick={onClose} type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Close modal">×</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
