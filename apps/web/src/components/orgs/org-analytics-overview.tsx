'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OrganizationAnalytics } from '@/supabase/data/reports';
import { formatCurrencyPHP } from '@/utils/formatters';

export interface OrgAnalyticsOverviewProps {
  analytics: OrganizationAnalytics;
  orgName: string;
  orgCode: string;
}

export function OrgAnalyticsOverview({
  analytics,
  orgName,
  orgCode,
}: OrgAnalyticsOverviewProps) {
  const { punctualityBreakdown } = analytics;

  return (
    <Card className="border border-slate-200/90 shadow-xs dark:border-slate-800">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Executive Organization Analytics
              </span>
              <Badge variant="primary" dot>
                {orgCode}
              </Badge>
            </div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
              Attendance Health & Turnout Overview
            </CardTitle>
            <CardDescription className="text-xs">
              Institutional compliance metrics and fine accountability for {orgName}.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-4">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-center dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">
              Compliance Rate
            </span>
            <span className="text-xl font-bold text-[#027013] dark:text-emerald-400">
              {analytics.overallAttendanceRate}%
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Average Turnout</span>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-center dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">
              Active Members
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {analytics.totalActiveMembers}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Enrolled Students</span>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-center dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-[11px] font-medium text-slate-400 block uppercase">
              Total Fines
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              {formatCurrencyPHP(analytics.totalFinesIncurred)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Incurred Dues</span>
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-center dark:border-amber-900/50 dark:bg-amber-950/20">
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 block uppercase">
              Pending Balance
            </span>
            <span className="text-xl font-bold text-amber-800 dark:text-amber-300 font-mono">
              {formatCurrencyPHP(analytics.totalFinesPending)}
            </span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 block mt-0.5">
              Unsettled Fines
            </span>
          </div>
        </div>

        {/* Punctuality Breakdown Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Punctuality & Attendance Distribution:
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Present ({punctualityBreakdown.present}%)
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Late ({punctualityBreakdown.late}%)
              </span>
              <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Absent ({punctualityBreakdown.absent}%)
              </span>
              <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-400">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                Excused ({punctualityBreakdown.excused}%)
              </span>
            </div>
          </div>

          <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex dark:bg-slate-800">
            <div
              style={{ width: `${punctualityBreakdown.present}%` }}
              className="bg-emerald-500 h-full transition-all duration-300"
              title="Present"
            />
            <div
              style={{ width: `${punctualityBreakdown.late}%` }}
              className="bg-amber-500 h-full transition-all duration-300"
              title="Late"
            />
            <div
              style={{ width: `${punctualityBreakdown.absent}%` }}
              className="bg-rose-500 h-full transition-all duration-300"
              title="Absent"
            />
            <div
              style={{ width: `${punctualityBreakdown.excused}%` }}
              className="bg-indigo-500 h-full transition-all duration-300"
              title="Excused"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
