'use client';

import React, { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { EventWithDetails } from '@/lib/definitions';
import { getMasterAttendanceReport } from '@/supabase/data/reports';
import { downloadCSV, generateMasterReportCSV } from '@/utils/csv-exporter';
import { formatCurrencyPHP, formatDateTime } from '@/utils/formatters';

export interface MasterReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventWithDetails | null;
}

export function MasterReportModal({ isOpen, onClose, event }: MasterReportModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');

  const report = useMemo(() => {
    return event ? getMasterAttendanceReport(event.id) : null;
  }, [event]);

  const filteredRoster = useMemo(() => {
    if (!report) return [];
    return report.roster.filter((item) => {
      const student = item.student;
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      const idMatches = student.student_id.toLowerCase().includes(searchQuery.toLowerCase());
      const nameMatches = fullName.includes(searchQuery.toLowerCase());

      if (searchQuery && !idMatches && !nameMatches) {
        return false;
      }

      if (selectedStatusFilter !== 'all' && item.overall_status !== selectedStatusFilter) {
        return false;
      }

      if (selectedYearFilter !== 'all' && student.year_level.toString() !== selectedYearFilter) {
        return false;
      }

      return true;
    });
  }, [report, searchQuery, selectedStatusFilter, selectedYearFilter]);

  if (!event || !report || !isOpen) return null;

  const handleExportCSV = () => {
    const csvContent = generateMasterReportCSV(report);
    const sanitizedTitle = event.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${event.organization.code}_${sanitizedTitle}_Master_Attendance_Report.csv`;
    downloadCSV(filename, csvContent);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Master Attendance & Compliance Report"
      description={`Official university roster and compliance audit for: ${event.title}`}
      maxWidth="xl"
    >
      <div className="space-y-4 pt-1">
        {/* Executive Summary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
          <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700">
            <span className="text-slate-400 block font-medium text-[11px]">Enrolled</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {report.total_enrolled}
            </span>
          </div>

          <div className="rounded-xl bg-emerald-50 p-2.5 border border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-800">
            <span className="text-emerald-700 dark:text-emerald-400 block font-medium text-[11px]">Present</span>
            <span className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
              {report.total_present}
            </span>
          </div>

          <div className="rounded-xl bg-amber-50 p-2.5 border border-amber-200/80 dark:bg-amber-950/40 dark:border-amber-800">
            <span className="text-amber-700 dark:text-amber-400 block font-medium text-[11px]">Late</span>
            <span className="text-lg font-bold text-amber-800 dark:text-amber-300">
              {report.total_late}
            </span>
          </div>

          <div className="rounded-xl bg-indigo-50 p-2.5 border border-indigo-200/80 dark:bg-indigo-950/40 dark:border-indigo-800">
            <span className="text-indigo-700 dark:text-indigo-400 block font-medium text-[11px]">Excused</span>
            <span className="text-lg font-bold text-indigo-800 dark:text-indigo-300">
              {report.total_excused}
            </span>
          </div>

          <div className="rounded-xl bg-rose-50 p-2.5 border border-rose-200/80 dark:bg-rose-950/40 dark:border-rose-800">
            <span className="text-rose-700 dark:text-rose-400 block font-medium text-[11px]">Absent</span>
            <span className="text-lg font-bold text-rose-800 dark:text-rose-300">
              {report.total_absent}
            </span>
          </div>

          <div className="rounded-xl bg-purple-50 p-2.5 border border-purple-200/80 dark:bg-purple-950/40 dark:border-purple-800">
            <span className="text-purple-700 dark:text-purple-400 block font-medium text-[11px]">Turnout</span>
            <span className="text-lg font-bold text-purple-800 dark:text-purple-300">
              {report.attendance_rate_percentage}%
            </span>
          </div>
        </div>

        {/* Filter & Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              placeholder="Search by student name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#027013] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-[#027013] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="excused">Excused</option>
              <option value="absent">Absent</option>
            </select>

            <select
              value={selectedYearFilter}
              onChange={(e) => setSelectedYearFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-[#027013] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Years</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleExportCSV} className="text-xs">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>Download CSV</span>
            </Button>
            <Button size="sm" variant="secondary" onClick={() => window.print()} className="text-xs">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-1.076-.673-2.684-.673-4.008 0-4.043 3.26-7.321 7.28-7.321s7.28 3.278 7.28 7.321c0 1.324-.433 2.932-.673 4.008M6.72 13.829A10.742 10.742 0 013 18.25m3.72-4.421c.24 1.077.673 2.684.673 4.009 0 2.21-1.79 4-4 4s-4-1.79-4-4c0-1.325.433-2.932.673-4.009M19.947 13.829c.24-1.076.673-2.684.673-4.008 0-2.21-1.79-4-4-4s-4 1.79-4 4c0 1.324.433 2.932.673 4.008" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 3h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Print Roster</span>
            </Button>
          </div>
        </div>

        {/* Master Roster Table */}
        <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Program & Year</TableHead>
                <TableHead>Check-In (Arrival)</TableHead>
                <TableHead>Check-Out (Egress)</TableHead>
                <TableHead className="text-right">Fine (PHP)</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoster.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-slate-400 text-xs">
                    No student attendees match the current search or filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoster.map((item) => (
                  <TableRow key={item.student.id}>
                    <TableCell className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {item.student.student_id}
                    </TableCell>
                    <TableCell className="font-medium text-xs text-slate-900 dark:text-slate-100">
                      {item.student.last_name}, {item.student.first_name}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400">
                      {item.student.course} - Year {item.student.year_level}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {item.time_in ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {formatDateTime(item.time_in.scanned_at).split(',')[1]}
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">Missed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {item.time_out ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {formatDateTime(item.time_out.scanned_at).split(',')[1]}
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400">Missed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {item.fine_amount > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          {formatCurrencyPHP(item.fine_amount)}
                        </span>
                      ) : (
                        <span className="text-slate-400">₱0.00</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.overall_status === 'present' && <Badge variant="success">Present</Badge>}
                      {item.overall_status === 'late' && <Badge variant="warning">Late</Badge>}
                      {item.overall_status === 'excused' && <Badge variant="primary">Excused</Badge>}
                      {item.overall_status === 'absent' && <Badge variant="danger">Absent</Badge>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Total Fines Incurred for this event:{' '}
            <strong className="text-slate-900 dark:text-slate-100 font-mono">
              {formatCurrencyPHP(report.total_fines_generated)}
            </strong>
          </span>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
