'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';
import { useOrg } from '@/context/org-context';
import { TenantRoleBadge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export function Header() {
  const { currentPersona, availablePersonas, switchPersona, userProfile } =
    useAuth();
  const { activeMembership, isStudentPortalActive } = useOrg();

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs dark:bg-slate-900 dark:border-slate-800">
      {/* Active Workspace Title & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span>HNU DASH</span>
          <span className="text-slate-300 dark:text-slate-700">/</span>
        </div>

        {isStudentPortalActive ? (
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 truncate dark:text-slate-100">
              Student Portal
            </h2>
            <span className="text-xs bg-[#027013]/15 text-[#027013] font-semibold px-2 py-0.5 rounded-full dark:bg-emerald-950 dark:text-emerald-300">
              Personal View
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate dark:text-slate-100">
              {activeMembership?.organization.name}
            </h2>
            <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-md dark:bg-slate-800 dark:text-slate-300">
              {activeMembership?.organization.code}
            </span>
            {activeMembership && (
              <TenantRoleBadge role={activeMembership.member_role} />
            )}
          </div>
        )}
      </div>

      {/* Development Persona Switcher & Theme Switcher */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Theme Toggle (Light / Dark / System) */}
        <ThemeToggle />

        {/* Development Persona Switcher */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/90 rounded-lg px-3 py-1.5 shadow-2xs dark:bg-slate-800 dark:border-slate-700">
          <label
            htmlFor="persona-select"
            className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Persona:</span>
          </label>
          <select
            id="persona-select"
            value={currentPersona.id}
            onChange={(e) => switchPersona(e.target.value)}
            className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
          >
            {availablePersonas.map((p) => (
              <option key={p.id} value={p.id} className="dark:bg-slate-800 dark:text-slate-200">
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {userProfile.role === 'admin' && (
          <span className="text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300/80 px-2.5 py-1 rounded-md dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
            Adviser Mode
          </span>
        )}
      </div>
    </header>
  );
}
