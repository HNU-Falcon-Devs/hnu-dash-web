'use client';

import React from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { WorkspaceView } from './workspace-view';

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Persistent Multi-Tenant Sidebar with "Your Organizations:" */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <WorkspaceView />
        </main>
      </div>
    </div>
  );
}
