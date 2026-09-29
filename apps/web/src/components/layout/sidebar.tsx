'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';
import { useOrg } from '@/context/org-context';
import { TenantRoleBadge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';

export interface SidebarProps {
  className?: string;
  onItemClick?: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function Sidebar({
  className,
  onItemClick,
  onClose,
  showCloseButton = false,
}: SidebarProps = {}) {
  const { userProfile, userMemberships } = useAuth();
  const { activeOrgId, selectOrg, isStudentPortalActive } = useOrg();

  const isGlobalAdmin = userProfile.role === 'admin';

  const handleSelect = (orgId: string | null) => {
    selectOrg(orgId);
    if (onItemClick) onItemClick();
  };

  return (
    <aside
      className={cn(
        'w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col h-screen sticky top-0 select-none dark:bg-slate-900 dark:border-slate-800',
        className
      )}
    >
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#027013] flex items-center justify-center text-amber-400 font-extrabold text-lg shadow-sm border border-amber-400/30 dark:bg-emerald-700">
            H
          </div>
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight leading-tight dark:text-white">
              HNU DASH
            </h1>
            <p className="text-xs text-slate-500 font-medium dark:text-slate-400">
              Holy Name University
            </p>
          </div>
        </div>

        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {/* Section 1: Universal Student Portal */}
        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 dark:text-slate-500">
            Student Portal
          </p>
          <nav className="space-y-1">
            <button
              onClick={() => handleSelect(null)}
              type="button"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer',
                isStudentPortalActive
                  ? 'bg-[#027013]/10 text-[#027013] font-semibold dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
              )}
            >
              <svg
                className={cn(
                  'h-4 w-4 shrink-0',
                  isStudentPortalActive
                    ? 'text-[#027013] dark:text-emerald-400'
                    : 'text-slate-400 dark:text-slate-500'
                )}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                />
              </svg>
              <span>Personal Dashboard</span>
            </button>
          </nav>
        </div>

        {/* Section 2: "Your Organizations:" */}
        <div>
          <div className="px-3 flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Your Organizations:
            </p>
            <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded-full dark:bg-slate-800 dark:text-slate-400">
              {userMemberships.length}
            </span>
          </div>

          <div className="space-y-1">
            {userMemberships.length === 0 ? (
              <p className="px-3 text-xs text-slate-400 italic dark:text-slate-500">
                No organizations joined yet.
              </p>
            ) : (
              userMemberships.map((membership) => {
                const isActive = activeOrgId === membership.organization.id;
                return (
                  <button
                    key={membership.organization.id}
                    onClick={() => handleSelect(membership.organization.id)}
                    type="button"
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm transition-all text-left cursor-pointer group',
                      isActive
                        ? 'bg-[#027013] text-white font-medium shadow-xs dark:bg-emerald-600'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          'h-7 w-7 rounded-md flex items-center justify-center font-bold text-xs shrink-0 transition-colors',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-slate-700'
                        )}
                      >
                        {membership.organization.code.slice(0, 2)}
                      </div>
                      <div className="min-w-0 truncate">
                        <p
                          className={cn(
                            'text-sm truncate',
                            isActive ? 'text-white font-semibold' : 'text-slate-800 font-medium dark:text-slate-200'
                          )}
                        >
                          {membership.organization.name}
                        </p>
                        <p
                          className={cn(
                            'text-[11px] truncate',
                            isActive ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'
                          )}
                        >
                          {membership.organization.code}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isActive ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-white/20 text-white px-2 py-0.5 rounded-full">
                          {membership.member_role}
                        </span>
                      ) : (
                        <TenantRoleBadge role={membership.member_role} />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Section 3: Faculty Adviser Tools (Shown if global admin) */}
        {isGlobalAdmin && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
              Adviser Controls
            </p>
            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl space-y-2 dark:bg-amber-950/30 dark:border-amber-800/50">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
                <svg
                  className="h-4 w-4 text-amber-600 shrink-0 dark:text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                  />
                </svg>
                <span>Institutional Authority</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-snug dark:text-amber-300">
                You have global adviser authority to manage campus organizations and appoint student admins.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* User Footer Card */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#027013]/15 text-[#027013] flex items-center justify-center font-bold text-sm shrink-0 border border-[#027013]/30 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
            {userProfile.first_name[0]}
            {userProfile.last_name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate dark:text-slate-100">
              {userProfile.first_name} {userProfile.last_name}
            </p>
            <p className="text-xs text-slate-500 truncate dark:text-slate-400">
              {userProfile.student_id} • {userProfile.course}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
