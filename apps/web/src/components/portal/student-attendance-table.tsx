'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { StudentAttendanceRecord } from '@/lib/definitions';
import { formatCurrencyPHP, formatDateTime } from '@/utils/formatters';

export interface StudentAttendanceTableProps {
  records: StudentAttendanceRecord[];
}

export function StudentAttendanceTable({ records }: StudentAttendanceTableProps) {
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [activeRecordForModal, setActiveRecordForModal] = useState<StudentAttendanceRecord | null>(null);

  // Available unique organizations in records
  const uniqueOrgs = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    records.forEach((r) => {
      map.set(r.event.organization_id, r.event.organization);
    });
    return Array.from(map.values());
  }, [records]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedOrgFilter !== 'all' && r.event.organization_id !== selectedOrgFilter) {
        return false;
      }
      if (selectedStatusFilter !== 'all' && r.overall_status !== selectedStatusFilter) {
        return false;
      }
      return true;
    });
  }, [records, selectedOrgFilter, selectedStatusFilter]);

  const totalFilteredFines = useMemo(() => {
    return filteredRecords.reduce((acc, r) => acc + r.fine_amount, 0);
  }, [filteredRecords]);

  return (
    <Card className="border border-slate-200/80 shadow-xs dark:border-slate-800">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
              Attendance Records & Fine Ledger
            </CardTitle>
            <CardDescription className="text-xs">
              Point-in-time check-in/out logs synced with official university attendance scanners.
            </CardDescription>
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-[#027013] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Organizations</option>
              {uniqueOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.code} — {org.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-[#027013] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed (Present)</option>
              <option value="partial">Partial (Missed 1 Scan)</option>
              <option value="missed">Missed (Absent)</option>
              <option value="excused">Excused</option>
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Event Details</TableHead>
              <TableHead>Check-In (Arrival)</TableHead>
              <TableHead>Check-Out (Egress)</TableHead>
              <TableHead className="text-right">Fine</TableHead>
              <TableHead className="text-center">Overall</TableHead>
              <TableHead className="text-right">Audit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">
                  No attendance records found matching the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((record) => {
                return (
                  <TableRow key={record.event.id}>
                    {/* Organization Code */}
                    <TableCell>
                      <span className="font-bold text-[#027013] text-xs bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60">
                        {record.event.organization.code}
                      </span>
                    </TableCell>

                    {/* Event Title & Location */}
                    <TableCell>
                      <div className="font-medium text-slate-900 dark:text-slate-100 text-xs">
                        {record.event.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {record.event.location} • {formatDateTime(record.event.event_start)}
                      </div>
                    </TableCell>

                    {/* Time-In Log */}
                    <TableCell>
                      {record.time_in_log ? (
                        <div className="text-xs">
                          <span className="font-mono font-medium text-emerald-700 dark:text-emerald-300">
                            {formatDateTime(record.time_in_log.scanned_at)}
                          </span>
                          <span className="block text-[10px] text-slate-400 capitalize">
                            Status: {record.time_in_log.status}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          ✕ Missed Check-In
                        </span>
                      )}
                    </TableCell>

                    {/* Time-Out Log */}
                    <TableCell>
                      {record.time_out_log ? (
                        <div className="text-xs">
                          <span className="font-mono font-medium text-emerald-700 dark:text-emerald-300">
                            {formatDateTime(record.time_out_log.scanned_at)}
                          </span>
                          <span className="block text-[10px] text-slate-400 capitalize">
                            Status: {record.time_out_log.status}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          ✕ Missed Check-Out
                        </span>
                      )}
                    </TableCell>

                    {/* Fine Amount */}
                    <TableCell className="text-right">
                      {record.fine_amount > 0 ? (
                        <span className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                          {formatCurrencyPHP(record.fine_amount)}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-slate-400">₱0.00</span>
                      )}
                    </TableCell>

                    {/* Overall Status Badge */}
                    <TableCell className="text-center">
                      {record.overall_status === 'completed' && (
                        <Badge variant="success">Completed</Badge>
                      )}
                      {record.overall_status === 'partial' && (
                        <Badge variant="warning">Partial Scan</Badge>
                      )}
                      {record.overall_status === 'missed' && (
                        <Badge variant="danger">Absent</Badge>
                      )}
                      {record.overall_status === 'excused' && (
                        <Badge variant="primary">Excused</Badge>
                      )}
                    </TableCell>

                    {/* Audit Button */}
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveRecordForModal(record)}
                        className="text-xs"
                      >
                        Receipt
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Footer Summary */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <span>Showing {filteredRecords.length} record(s)</span>
          <span className="font-medium">
            Total Fine for Selected View:{' '}
            <strong className="text-slate-900 dark:text-slate-100 font-mono">
              {formatCurrencyPHP(totalFilteredFines)}
            </strong>
          </span>
        </div>
      </CardContent>

      {/* Audit Detail Modal */}
      {activeRecordForModal && (
        <Modal
          isOpen={true}
          onClose={() => setActiveRecordForModal(null)}
          title="Attendance Log Verification Receipt"
          description={`Cryptographic scan log audit for: ${activeRecordForModal.event.title}`}
          maxWidth="md"
        >
          <div className="space-y-4 pt-1">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/50 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Host Organization:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {activeRecordForModal.event.organization.name} ({activeRecordForModal.event.organization.code})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Event Date:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {formatDateTime(activeRecordForModal.event.event_start)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fine Policy Rate:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  ₱{activeRecordForModal.event.fine_per_missed_scan_student.toFixed(2)} per missed scan
                </span>
              </div>
            </div>

            {/* Check-In Scan Ledger */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 text-xs space-y-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300 block uppercase text-[10px]">
                1. Check-In Scan Transaction
              </span>
              {activeRecordForModal.time_in_log ? (
                <div className="space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Scan Timestamp:</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-300">
                      {formatDateTime(activeRecordForModal.time_in_log.scanned_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Server Sync Time:</span>
                    <span className="font-mono text-slate-500">
                      {formatDateTime(activeRecordForModal.time_in_log.synced_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Verification Log ID:</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {activeRecordForModal.time_in_log.id}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-rose-600 dark:text-rose-400 font-semibold">
                  No scan recorded during official Time-In window.
                </p>
              )}
            </div>

            {/* Check-Out Scan Ledger */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 text-xs space-y-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300 block uppercase text-[10px]">
                2. Check-Out Scan Transaction
              </span>
              {activeRecordForModal.time_out_log ? (
                <div className="space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Scan Timestamp:</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-300">
                      {formatDateTime(activeRecordForModal.time_out_log.scanned_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Server Sync Time:</span>
                    <span className="font-mono text-slate-500">
                      {formatDateTime(activeRecordForModal.time_out_log.synced_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Verification Log ID:</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {activeRecordForModal.time_out_log.id}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-rose-600 dark:text-rose-400 font-semibold">
                  No scan recorded during official Time-Out window.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Incurred Penalty Fine: <strong>{formatCurrencyPHP(activeRecordForModal.fine_amount)}</strong>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setActiveRecordForModal(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
