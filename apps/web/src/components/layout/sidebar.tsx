'use client';

import React from 'react';
import { useAuth } from '@/context/auth-context';
import { useOrg } from '@/context/org-context';
import { TenantRoleBadge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';

export function Sidebar() {
  const { userProfile, userMemberships } = useAuth();
  const { activeOrgId, selectOrg, isStudentPortalActive } = useOrg();

  const isGlobalAdmin = userProfile.role === 'admin';

  return (
    <aside className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col h-screen sticky top-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-800 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            H
          </div>
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight leading-tight">
              HNU DASH
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Attendance System
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {/* Section 1: Universal Student Portal */}
        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Student Portal
          </p>
          <nav className="space-y-1">
            <button
              onClick={() => selectOrg(null)}
              type="button"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer',
                isStudentPortalActive
                  ? 'bg-blue-50 text-blue-800 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <svg
                className={cn(
                  'h-4 w-4 shrink-0',
                  isStudentPortalActive ? 'text-blue-800' : 'text-slate-400'
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
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Your Organizations:
            </p>
            <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded-full">
              {userMemberships.length}
            </span>
          </div>

          <div className="space-y-1">
            {userMemberships.length === 0 ? (
              <p className="px-3 text-xs text-slate-400 italic">
                No organizations joined yet.
              </p>
            ) : (
              userMemberships.map((membership) => {
                const isActive = activeOrgId === membership.organization.id;
                return (
                  <button
                    key={membership.organization.id}
                    onClick={() => selectOrg(membership.organization.id)}
                    type="button"
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm transition-all text-left cursor-pointer group',
                      isActive
                        ? 'bg-blue-800 text-white font-medium shadow-xs'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={cn(
                          'h-7 w-7 rounded-md flex items-center justify-center font-bold text-xs shrink-0 transition-colors',
                          isActive
                            ? 'bg-blue-700 text-white'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                        )}
                      >
                        {membership.organization.code.slice(0, 2)}
                      </div>
                      <div className="min-w-0 truncate">
                        <p
                          className={cn(
                            'text-sm truncate',
                            isActive ? 'text-white font-semibold' : 'text-slate-800 font-medium'
                          )}
                        >
                          {membership.organization.name}
                        </p>
                        <p
                          className={cn(
                            'text-[11px] truncate',
                            isActive ? 'text-blue-200' : 'text-slate-400'
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
          <div className="pt-2 border-t border-slate-100">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-amber-600 mb-2">
              Adviser Controls
            </p>
            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                <svg
                  className="h-4 w-4 text-amber-600 shrink-0"
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
              <p className="text-[11px] text-amber-800 leading-snug">
                You have global adviser authority to manage campus organizations and appoint student admins.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* User Footer Card */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-200/60">
            {userProfile.first_name[0]}
            {userProfile.last_name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {userProfile.first_name} {userProfile.last_name}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {userProfile.student_id} • {userProfile.course}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
