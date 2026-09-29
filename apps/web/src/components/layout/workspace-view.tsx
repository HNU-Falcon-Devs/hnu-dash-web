'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { useOrg } from '@/context/org-context';
import { Button } from '@/components/ui/button';
import { TenantRoleBadge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { formatCurrencyPHP, formatDateTime, formatTargetYearLevels, formatTimeRange } from '@/utils/formatters';
import { MOCK_EVENTS, MOCK_STUDENT_ATTENDANCE } from '@/lib/mock-data';

export function WorkspaceView() {
  const { userProfile } = useAuth();
  const { activeMembership, isStudentPortalActive, permissions, selectOrg } = useOrg();
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [activeEventTitle, setActiveEventTitle] = useState('');

  // Events filtered for the active organization
  const orgEvents = MOCK_EVENTS.filter(
    (e) => e.organization_id === activeMembership?.organization.id
  );

  // -------------------------------------------------------------
  // VIEW 1: Universal Student Portal
  // -------------------------------------------------------------
  if (isStudentPortalActive) {
    const totalDues = MOCK_STUDENT_ATTENDANCE.reduce(
      (sum, item) => sum + item.fine_amount,
      0
    );

    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Welcome Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-8 text-white shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center text-xs font-semibold uppercase tracking-widest text-blue-200 bg-white/10 px-3 py-1 rounded-full mb-3">
                Holy Name University • Student Portal
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Welcome back, {userProfile.first_name}!
              </h1>
              <p className="mt-2 text-sm text-blue-100 max-w-xl">
                Track your university attendance across all organizations, check upcoming event call-times, and review clearance compliance.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-4 shrink-0 text-right">
              <p className="text-xs text-blue-200 uppercase tracking-wider font-semibold">
                Clearance Dues
              </p>
              <p className="text-2xl font-bold mt-1 text-white">
                {formatCurrencyPHP(totalDues)}
              </p>
              <span className="inline-block mt-1 text-[11px] font-medium text-emerald-300">
                {totalDues === 0 ? '✓ Fully Cleared' : 'Pending Payments'}
              </span>
            </div>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Card>
            <CardHeader className="p-5 pb-2">
              <CardDescription>Attended Events</CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {MOCK_STUDENT_ATTENDANCE.filter((a) => a.overall_status === 'completed').length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs text-emerald-600 font-medium">
              Verified Time-In & Time-Out
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-2">
              <CardDescription>Missed / Partial Scans</CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-600">
                {MOCK_STUDENT_ATTENDANCE.filter((a) => a.overall_status !== 'completed').length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs text-amber-700 font-medium">
              Subject to organization fines
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5 pb-2">
              <CardDescription>Upcoming University Events</CardDescription>
              <CardTitle className="text-2xl font-bold text-blue-800">
                {MOCK_EVENTS.length}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 text-xs text-slate-500 font-medium">
              Scheduled this semester
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events Across All Organizations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upcoming Events (All Organizations)</CardTitle>
                <CardDescription>
                  Aggregated schedule for events where your membership requires attendance.
                </CardDescription>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {MOCK_EVENTS.length} events found
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Host Org</TableHead>
                  <TableHead>Event Title & Venue</TableHead>
                  <TableHead>Event Date & Schedule</TableHead>
                  <TableHead>Student Time-In Window</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_EVENTS.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <span className="font-bold text-blue-800 text-xs bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md">
                        {event.organization.code}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-slate-900">{event.title}</p>
                      <p className="text-xs text-slate-500">{event.location}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-slate-800 font-medium">
                        {formatDateTime(event.event_start)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded font-mono">
                        {formatTimeRange(event.attendance_in_start, event.attendance_in_end)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-600">
                        {formatTargetYearLevels(event.target_year_levels)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectOrg(event.organization_id)}
                      >
                        View Org
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: Organization-Scoped Workspace
  // -------------------------------------------------------------
  const org = activeMembership!.organization;
  const role = activeMembership!.member_role;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Organization Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-slate-900 text-white px-2.5 py-0.5 rounded-md">
              {org.code}
            </span>
            <TenantRoleBadge role={role} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{org.name}</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">{org.description}</p>
        </div>

        {/* Action Controls for Org Admins */}
        <div className="flex items-center gap-2.5 shrink-0">
          {permissions.canManageEvents && (
            <Button size="md" variant="primary">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Create Event</span>
            </Button>
          )}
          {permissions.canAssignScanners && (
            <Button size="md" variant="outline">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.765z" />
              </svg>
              <span>Assign Officers</span>
            </Button>
          )}
        </div>
      </div>

      {/* Role Capability Banner */}
      <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50 flex items-center justify-between text-xs text-slate-700">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">Your Scoped Permissions:</span>
          <span>
            {permissions.canManageEvents
              ? 'Full Organization Administrative Access (Events, Scanner Delegation, Records)'
              : role === 'officer'
              ? 'Officer Access (Eligible for Scanner Delegation, Early Call-Times Apply)'
              : 'Regular Member Access (View Schedule & Attend Events)'}
          </span>
        </div>
        <button
          onClick={() => selectOrg(null)}
          className="text-blue-800 font-semibold hover:underline cursor-pointer"
        >
          ← Return to Student Portal
        </button>
      </div>

      {/* Organization Event Management Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Organization Events</CardTitle>
              <CardDescription>
                Events scheduled under {org.name}.
              </CardDescription>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {orgEvents.length} total event(s)
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Title & Venue</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Officer Call Time</TableHead>
                <TableHead>Attendee Window</TableHead>
                <TableHead>Fines (Student / Officer)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    No events scheduled for this organization yet.
                  </TableCell>
                </TableRow>
              ) : (
                orgEvents.map((event) => {
                  const canScan = permissions.canScanEvent(event.id);
                  return (
                    <TableRow key={event.id}>
                      <TableCell>
                        <p className="font-semibold text-slate-900">{event.title}</p>
                        <p className="text-xs text-slate-500">{event.location}</p>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-800">
                        {formatDateTime(event.event_start)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono bg-purple-50 text-purple-800 border border-purple-200/80 px-2 py-0.5 rounded">
                          {formatTimeRange(event.officer_in_start, event.officer_in_end)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                          {formatTimeRange(event.attendance_in_start, event.attendance_in_end)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium text-slate-800">
                          {formatCurrencyPHP(event.fine_per_missed_scan_student)}
                        </span>
                        <span className="text-slate-400"> / </span>
                        <span className="font-medium text-rose-700">
                          {formatCurrencyPHP(event.fine_per_missed_scan_officer)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {canScan && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setActiveEventTitle(event.title);
                              setIsScannerModalOpen(true);
                            }}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM14.625 3.75c-.621 0-1.125.504-1.125 1.125v4.5c0 .621.504 1.125 1.125 1.125h4.5c.621 0 1.125-.504 1.125-1.125v-4.5c0-.621-.504-1.125-1.125-1.125h-4.5zM14.625 14.625c-.621 0-1.125.504-1.125 1.125v4.5c0 .621.504 1.125 1.125 1.125h4.5c.621 0 1.125-.504 1.125-1.125v-4.5c0-.621-.504-1.125-1.125-1.125h-4.5z" />
                            </svg>
                            <span>Scan</span>
                          </Button>
                        )}
                        {permissions.canManageEvents && (
                          <Button size="sm" variant="outline">
                            Review
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Scanner Simulation Modal */}
      <Modal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        title="Web QR Scanner Interface"
        description={`Authorized attendance scanner for: ${activeEventTitle}`}
      >
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-8 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center mb-3">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-blue-900">
              Camera Ready for ID Barcode / QR Scan
            </p>
            <p className="mt-1 text-xs text-blue-700">
              Only officers designated in event_assigned_scanners can log scans.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIsScannerModalOpen(false)}>
              Close
            </Button>
            <Button variant="primary" onClick={() => setIsScannerModalOpen(false)}>
              Simulate Successful Scan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
