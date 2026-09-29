'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { StudentClearanceStatus } from '@/lib/definitions';
import { formatCurrencyPHP } from '@/utils/formatters';

export interface StudentClearanceSummaryProps {
  clearance: StudentClearanceStatus;
}

export function StudentClearanceSummary({ clearance }: StudentClearanceSummaryProps) {
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const isCleared = clearance.overall_status === 'cleared';

  return (
    <>
      <Card className="overflow-hidden border-2 border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div
          className={`h-1.5 w-full ${
            isCleared ? 'bg-[#027013] dark:bg-emerald-500' : 'bg-amber-500 dark:bg-amber-400'
          }`}
        />
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Semester Clearance Status
                </span>
                {isCleared ? (
                  <Badge variant="success" dot>
                    CLEARED
                  </Badge>
                ) : (
                  <Badge variant="warning" dot>
                    CLEARANCE HOLD
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl font-bold mt-1 text-slate-900 dark:text-slate-100">
                {isCleared ? (
                  <span className="text-[#027013] dark:text-emerald-400">
                    Eligible for Semester Sign-off
                  </span>
                ) : (
                  <span className="text-amber-800 dark:text-amber-300">
                    Outstanding Fines: {formatCurrencyPHP(clearance.total_fines)}
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {isCleared
                  ? 'All organization attendance requirements and mandatory check-in/out policies have been satisfied.'
                  : 'Settlement of unpaid attendance deficiency fines is required before official sign-off.'}
              </CardDescription>
            </div>

            <Button
              size="sm"
              variant={isCleared ? 'primary' : 'outline'}
              onClick={() => setIsSlipModalOpen(true)}
              className="shrink-0"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.72 13.829c-.24-1.076-.673-2.684-.673-4.008 0-4.043 3.26-7.321 7.28-7.321s7.28 3.278 7.28 7.321c0 1.324-.433 2.932-.673 4.008M6.72 13.829A10.742 10.742 0 013 18.25m3.72-4.421c.24 1.077.673 2.684.673 4.009 0 2.21-1.79 4-4 4s-4-1.79-4-4c0-1.325.433-2.932.673-4.009M19.947 13.829c.24-1.076.673-2.684.673-4.008 0-2.21-1.79-4-4-4s-4 1.79-4 4c0 1.324.433 2.932.673 4.008"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 3h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span>View Clearance Slip</span>
            </Button>
          </div>
        </CardHeader>

        {/* Multi-Tenant Organization Breakdown Bar */}
        <CardContent className="p-5 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-2">
            {clearance.organization_breakdowns.map((breakdown) => {
              const isOrgCleared = breakdown.status === 'cleared';
              return (
                <div
                  key={breakdown.organization.id}
                  className={`rounded-xl border p-3 text-xs transition-colors ${
                    isOrgCleared
                      ? 'bg-slate-50/70 border-slate-200/80 dark:bg-slate-800/50 dark:border-slate-800'
                      : 'bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#027013] dark:text-emerald-400">
                      {breakdown.organization.code}
                    </span>
                    <Badge variant={isOrgCleared ? 'success' : 'warning'}>
                      {isOrgCleared ? 'CLEARED' : `₱${breakdown.total_fines.toFixed(2)}`}
                    </Badge>
                  </div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1 line-clamp-1">
                    {breakdown.organization.name}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      Attended: {breakdown.attended_events} / {breakdown.total_events}
                    </span>
                    <span>
                      Missed: {breakdown.missed_events}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Official Clearance Slip Modal */}
      <Modal
        isOpen={isSlipModalOpen}
        onClose={() => setIsSlipModalOpen(false)}
        title="Official Student Clearance Slip"
        description="Institutional verification certificate for semester attendance compliance."
        maxWidth="lg"
      >
        <div className="space-y-6 pt-2">
          {/* Printable Document Box */}
          <div
            id="clearance-slip-printable"
            className="rounded-xl border border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 shadow-xs space-y-5"
          >
            {/* Header / Seal */}
            <div className="text-center border-b border-slate-200 pb-4 dark:border-slate-800">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[#027013]/10 text-[#027013] dark:bg-emerald-950 dark:text-emerald-400 mb-2">
                <span className="font-black text-lg">HNU</span>
              </div>
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                HOLY NAME UNIVERSITY
              </h3>
              <p className="text-xs uppercase font-medium text-slate-500 dark:text-slate-400">
                Office of Student Affairs & Student Governance
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                City of Tagbilaran, Bohol, Philippines
              </p>
            </div>

            {/* Student Particulars */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Student Name
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {clearance.student.first_name} {clearance.student.last_name}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Student ID Number
                </span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                  {clearance.student.student_id}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Degree Program & Year
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {clearance.student.course} — Year {clearance.student.year_level}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Date Generated
                </span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Organizations Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Multi-Tenant Organization Attendance Ledger
              </h4>
              <table className="w-full text-left text-xs border border-slate-200 dark:border-slate-800">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="p-2 border-b">Organization</th>
                    <th className="p-2 border-b text-center">Attended</th>
                    <th className="p-2 border-b text-center">Missed</th>
                    <th className="p-2 border-b text-right">Balance</th>
                    <th className="p-2 border-b text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {clearance.organization_breakdowns.map((b) => (
                    <tr key={b.organization.id}>
                      <td className="p-2 font-medium">
                        {b.organization.name} ({b.organization.code})
                      </td>
                      <td className="p-2 text-center">{b.attended_events}</td>
                      <td className="p-2 text-center">{b.missed_events}</td>
                      <td className="p-2 text-right font-mono">
                        {formatCurrencyPHP(b.total_fines)}
                      </td>
                      <td className="p-2 text-center">
                        <span
                          className={`inline-block font-bold text-[10px] px-1.5 py-0.5 rounded ${
                            b.status === 'cleared'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {b.status === 'cleared' ? 'CLEARED' : 'HOLD'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Verification Signature Blocks */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 dark:border-slate-800 text-center">
              <div>
                <div className="border-b border-slate-400 dark:border-slate-600 w-3/4 mx-auto mb-1" />
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Organization President / Treasurer
                </p>
                <p className="text-[10px] text-slate-400">Authorized Officer Signature</p>
              </div>
              <div>
                <div className="border-b border-slate-400 dark:border-slate-600 w-3/4 mx-auto mb-1" />
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  Faculty Adviser / Student Affairs
                </p>
                <p className="text-[10px] text-slate-400">Institutional Endorsement</p>
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              * Document hash is recorded in PostgreSQL authoritative logs.
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.076-.673-2.684-.673-4.008 0-4.043 3.26-7.321 7.28-7.321s7.28 3.278 7.28 7.321c0 1.324-.433 2.932-.673 4.008M6.72 13.829A10.742 10.742 0 013 18.25m3.72-4.421c.24 1.077.673 2.684.673 4.009 0 2.21-1.79 4-4 4s-4-1.79-4-4c0-1.325.433-2.932.673-4.009M19.947 13.829c.24-1.076.673-2.684.673-4.008 0-2.21-1.79-4-4-4s-4 1.79-4 4c0 1.324.433 2.932.673 4.008" />
                </svg>
                <span>Print Slip</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsSlipModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
