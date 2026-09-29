'use client';

import React from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { WorkspaceView } from './workspace-view';

export function AppShell() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Persistent Multi-Tenant Sidebar */}
      <Sidebar className="hidden md:flex" />

      {/* Mobile Slide-Over Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl bg-white dark:bg-slate-900 animate-in slide-in-from-left duration-200">
            <Sidebar
              showCloseButton
              onClose={() => setIsMobileMenuOpen(false)}
              onItemClick={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 overflow-y-auto">
          <WorkspaceView />
        </main>
      </div>
    </div>
  );
}
