'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { AttendanceStatusBadge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AttendanceLog, AttendanceStatus, EventWithDetails } from '@/lib/definitions';
import { getAttendanceLogsForEvent } from '@/supabase/data/events';
import { overrideAttendanceStatusAction } from '@/supabase/actions/event-actions';
import { formatDateTime } from '@/utils/formatters';

export interface AttendanceReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventWithDetails | null;
}

export function AttendanceReviewModal({
  isOpen,
  onClose,
  event,
}: AttendanceReviewModalProps) {
  const [logs, setLogs] = useState<AttendanceLog[]>(() =>
    event ? getAttendanceLogsForEvent(event.id) : []
  );

  if (!event || !isOpen) return null;

  const handleOverride = (logId: string, newStatus: AttendanceStatus) => {
    const result = overrideAttendanceStatusAction(logId, newStatus);
    if (result.success) {
      setLogs((prev) =>
        prev.map((log) => (log.id === logId ? { ...log, status: newStatus } : log))
      );
    }
  };

  const presentCount = logs.filter((l) => l.status === 'present').length;
  const lateCount = logs.filter((l) => l.status === 'late').length;
  const excusedCount = logs.filter((l) => l.status === 'excused').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attendance Record Audit & Review"
      description={`Real-time scan logs and status verification for ${event.title}`}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Metric Summary Bar */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/80 dark:bg-slate-800 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Total Scans</span>
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{logs.length}</span>
          </div>
          <div className="rounded-lg bg-emerald-50 p-2.5 border border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-800">
            <span className="text-emerald-700 dark:text-emerald-300 block font-medium">Present</span>
            <span className="text-lg font-bold text-emerald-800 dark:text-emerald-200">{presentCount}</span>
          </div>
          <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-200/80 dark:bg-amber-950/40 dark:border-amber-800">
            <span className="text-amber-700 dark:text-amber-300 block font-medium">Late</span>
            <span className="text-lg font-bold text-amber-800 dark:text-amber-200">{lateCount}</span>
          </div>
          <div className="rounded-lg bg-indigo-50 p-2.5 border border-indigo-200/80 dark:bg-indigo-950/40 dark:border-indigo-800">
            <span className="text-indigo-700 dark:text-indigo-300 block font-medium">Excused</span>
            <span className="text-lg font-bold text-indigo-800 dark:text-indigo-200">{excusedCount}</span>
          </div>
        </div>

        {/* Logs Table */}
        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Scanned At (Device)</TableHead>
                <TableHead>Server Sync (Anti-Tamper)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Admin Override</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-slate-400">
                    No scans recorded yet for this event.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <span className="font-mono text-xs uppercase font-bold text-slate-800 dark:text-slate-200">
                        {log.type.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                      {formatDateTime(log.scanned_at)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {formatDateTime(log.synced_at)}
                    </TableCell>
                    <TableCell>
                      <AttendanceStatusBadge status={log.status} />
                    </TableCell>
                    <TableCell className="text-right space-x-1.5">
                      {log.status !== 'excused' && (
                        <button
                          type="button"
                          onClick={() => handleOverride(log.id, 'excused')}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Mark Excused
                        </button>
                      )}
                      {log.status !== 'present' && (
                        <button
                          type="button"
                          onClick={() => handleOverride(log.id, 'present')}
                          className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          Mark Present
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            * Synced timestamps represent authoritative server time when synced to PostgreSQL.
          </p>
          <Button variant="secondary" onClick={onClose}>
            Close Review
          </Button>
        </div>
      </div>
    </Modal>
  );
}
