'use client';

import React from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { WorkspaceView } from './workspace-view';

export function AppShell({ userEmail, activePath = "/", children }: { userEmail?: string; activePath?: "/" | "/organizations" | "/events"; children?: React.ReactNode } = {}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const drawerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const drawer = drawerRef.current;
    if (!drawer) return;

    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(drawer.querySelectorAll<HTMLElement>(focusableSelector));
    (getFocusable()[0] ?? drawer).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsMobileMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        drawer.focus();
      } else if (!drawer.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const containFocus = (event: FocusEvent) => {
      if (!drawer.contains(event.target as Node)) (getFocusable()[0] ?? drawer).focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', containFocus);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', containFocus);
      previouslyFocused?.focus();
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop navigation */}
      <Sidebar className="hidden md:flex" activePath={activePath} />

      {/* Mobile navigation drawer */}
      {isMobileMenuOpen && (
        <div id="mobile-navigation" className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div ref={drawerRef} tabIndex={-1} className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl bg-white dark:bg-slate-900 animate-in slide-in-from-left duration-200">
            <Sidebar
              activePath={activePath}
              showCloseButton
              onClose={() => setIsMobileMenuOpen(false)}
              onItemClick={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} isMenuOpen={isMobileMenuOpen} userEmail={userEmail} />
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 overflow-y-auto">
          {children ?? <WorkspaceView />}
        </main>
      </div>
    </div>
  );
}
