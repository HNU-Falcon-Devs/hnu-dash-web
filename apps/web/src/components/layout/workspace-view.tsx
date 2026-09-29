'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { useOrg } from '@/context/org-context';
import { Button } from '@/components/ui/button';
import { TenantRoleBadge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { formatCurrencyPHP, formatDateTime, formatTimeRange } from '@/utils/formatters';
import type { EventWithDetails } from '@/lib/definitions';
import { getAllEvents } from '@/supabase/data/events';
import {
  getStudentAttendanceRecords,
  getStudentClearanceStatus,
  getStudentUpcomingEvents,
} from '@/supabase/data/student-portal';
import { EventFormModal } from '@/components/orgs/event-form-modal';
import { ScannerAssignmentModal } from '@/components/orgs/scanner-assignment-modal';
import { AttendanceReviewModal } from '@/components/orgs/attendance-review-modal';
import { MasterReportModal } from '@/components/orgs/master-report-modal';
import { OrgAnalyticsOverview } from '@/components/orgs/org-analytics-overview';
import { getOrganizationAnalytics } from '@/supabase/data/reports';
import { StudentClearanceSummary } from '@/components/portal/student-clearance-summary';
import { StudentAttendanceTable } from '@/components/portal/student-attendance-table';
import { StudentEventsFeed } from '@/components/portal/student-events-feed';

export function WorkspaceView() {
  const { userProfile, userMemberships } = useAuth();
  const { activeMembership, isStudentPortalActive, permissions, selectOrg } = useOrg();

  // Modals State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEventForScanners, setSelectedEventForScanners] = useState<EventWithDetails | null>(null);
  const [selectedEventForReview, setSelectedEventForReview] = useState<EventWithDetails | null>(null);
  const [selectedEventForReport, setSelectedEventForReport] = useState<EventWithDetails | null>(null);

  // Scanner Simulator Modal State
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [activeEventTitle, setActiveEventTitle] = useState('');

  // Local state for event listing (allows newly created events to show immediately)
  const [events, setEvents] = useState<EventWithDetails[]>(() => getAllEvents());
  const refreshEvents = () => setEvents([...getAllEvents()]);

  // Filter events for the active organization or all events for student portal
  const orgEvents = activeMembership
    ? events.filter((e) => e.organization_id === activeMembership.organization.id)
    : [];

  // -------------------------------------------------------------
  // VIEW 1: Universal Student Portal
  // -------------------------------------------------------------
  if (isStudentPortalActive) {
    const studentRecords = getStudentAttendanceRecords(userProfile.id);
    const studentClearance = getStudentClearanceStatus(userProfile, userMemberships);
    const enrolledOrgIds = userMemberships.map((m) => m.organization.id);
    const studentUpcomingEvents = getStudentUpcomingEvents(
      userProfile.year_level,
      enrolledOrgIds
    );

    const isCleared = studentClearance.overall_status === 'cleared';

    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Welcome Banner (HNU Green & Gold) */}
        <div className="rounded-2xl bg-gradient-to-r from-[#027013] via-[#01540e] to-emerald-950 p-8 text-white shadow-sm border border-emerald-800/40 relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center text-xs font-semibold uppercase tracking-widest text-amber-300 bg-amber-400/15 border border-amber-300/30 px-3 py-1 rounded-full mb-3 shadow-xs">
                Holy Name University • Student Portal
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Welcome back, {userProfile.first_name}!
              </h1>
              <p className="mt-2 text-sm text-emerald-100 max-w-xl">
                {userProfile.student_id} • {userProfile.course} (Year {userProfile.year_level}) • Enrolled in {userMemberships.length} Student Organizations.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-xl p-4 shrink-0 text-right dark:bg-slate-900/60 dark:border-white/10">
              <p className="text-xs text-amber-300 uppercase tracking-wider font-semibold">
                Clearance Dues
              </p>
              <p className="text-2xl font-bold mt-1 text-white">
                {formatCurrencyPHP(studentClearance.total_fines)}
              </p>
              <span className="inline-block mt-1 text-[11px] font-medium text-emerald-200">
                {isCleared ? '✓ Fully Cleared' : 'Pending Settlement'}
              </span>
            </div>
          </div>
        </div>

        {/* Clearance Breakdown Summary */}
        <StudentClearanceSummary clearance={studentClearance} />

        {/* Upcoming Events Feed */}
        <StudentEventsFeed events={studentUpcomingEvents} />

        {/* Attendance Records & Fine Ledger */}
        <StudentAttendanceTable records={studentRecords} />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW 2: Organization-Scoped Workspace
  // -------------------------------------------------------------
  const org = activeMembership!.organization;
  const role = activeMembership!.member_role;
  const orgAnalytics = getOrganizationAnalytics(org.id);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Organization Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-[#027013] text-white px-2.5 py-0.5 rounded-md dark:bg-emerald-700">
              {org.code}
            </span>
            <TenantRoleBadge role={role} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{org.name}</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl dark:text-slate-400">{org.description}</p>
        </div>

        {/* Action Controls for Org Admins */}
        <div className="flex items-center gap-2.5 shrink-0">
          {permissions.canManageEvents && (
            <Button size="md" variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Create Event</span>
            </Button>
          )}
        </div>
      </div>

      {/* Role Capability Banner */}
      <div className="p-4 rounded-xl border border-slate-200/90 bg-slate-50 flex items-center justify-between text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900 dark:text-slate-100">Your Scoped Permissions:</span>
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
          className="text-[#027013] font-semibold hover:underline cursor-pointer dark:text-emerald-400"
        >
          ← Return to Student Portal
        </button>
      </div>

      {/* Executive Organization Analytics Overview (Admin Only) */}
      {permissions.canViewAnalytics && (
        <OrgAnalyticsOverview
          analytics={orgAnalytics}
          orgName={org.name}
          orgCode={org.code}
        />
      )}

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
            <span className="text-xs text-slate-500 font-medium dark:text-slate-400">
              {orgEvents.length} total event(s)
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Title & Venue</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Officer Call Time</TableHead>
                  <TableHead>Attendee Window</TableHead>
                  <TableHead>Fines (Student / Officer)</TableHead>
                  <TableHead className="text-right whitespace-nowrap min-w-[280px]">Actions</TableHead>
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
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{event.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{event.location}</p>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {formatDateTime(event.event_start)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono bg-purple-50 text-purple-800 border border-purple-200/80 px-2 py-0.5 rounded dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60">
                            {formatTimeRange(event.officer_in_start, event.officer_in_end)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded dark:bg-slate-800 dark:text-slate-200">
                            {formatTimeRange(event.attendance_in_start, event.attendance_in_end)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {formatCurrencyPHP(event.fine_per_missed_scan_student)}
                          </span>
                          <span className="text-slate-400"> / </span>
                          <span className="font-medium text-rose-700 dark:text-rose-400">
                            {formatCurrencyPHP(event.fine_per_missed_scan_officer)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap min-w-[280px]">
                          <div className="flex items-center justify-end gap-1.5 flex-nowrap">
                            {canScan && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => {
                                  setActiveEventTitle(event.title);
                                  setIsScannerModalOpen(true);
                                }}
                                className="h-8 px-2.5 text-xs inline-flex items-center gap-1 shrink-0"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM14.625 3.75c-.621 0-1.125.504-1.125 1.125v4.5c0 .621.504 1.125 1.125 1.125h4.5c.621 0 1.125-.504 1.125-1.125v-4.5c0-.621-.504-1.125-1.125-1.125h-4.5zM14.625 14.625c-.621 0-1.125.504-1.125 1.125v4.5c0 .621.504 1.125 1.125 1.125h4.5c.621 0 1.125-.504 1.125-1.125v-4.5c0-.621-.504-1.125-1.125-1.125h-4.5z" />
                                </svg>
                                <span>Scan</span>
                              </Button>
                            )}
                            {permissions.canAssignScanners && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setSelectedEventForScanners(event)}
                                className="h-8 px-2.5 text-xs shrink-0"
                              >
                                Scanners
                              </Button>
                            )}
                            {permissions.canManageEvents && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedEventForReview(event)}
                                className="h-8 px-2.5 text-xs shrink-0"
                              >
                                Review
                              </Button>
                            )}
                            {permissions.canViewReports && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedEventForReport(event)}
                                className="h-8 px-2.5 text-xs shrink-0 inline-flex items-center gap-1"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                <span>Report</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Event Creation Modal */}
      {permissions.canManageEvents && (
        <EventFormModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          organizationId={org.id}
          organizationName={org.name}
          organizationCode={org.code}
          userId={userProfile.id}
          onEventCreated={() => {
            refreshEvents();
          }}
        />
      )}

      {/* Scanner Assignment Modal */}
      {permissions.canAssignScanners && selectedEventForScanners && (
        <ScannerAssignmentModal
          key={selectedEventForScanners.id}
          isOpen={true}
          onClose={() => setSelectedEventForScanners(null)}
          event={selectedEventForScanners}
          onAssignmentChange={() => {
            refreshEvents();
          }}
        />
      )}

      {/* Attendance Review Modal */}
      {permissions.canManageEvents && selectedEventForReview && (
        <AttendanceReviewModal
          key={selectedEventForReview.id}
          isOpen={true}
          onClose={() => setSelectedEventForReview(null)}
          event={selectedEventForReview}
        />
      )}

      {/* Master Attendance Report Modal (Admin Only) */}
      {permissions.canViewReports && selectedEventForReport && (
        <MasterReportModal
          key={selectedEventForReport.id}
          isOpen={true}
          onClose={() => setSelectedEventForReport(null)}
          event={selectedEventForReport}
        />
      )}

      {/* Scanner Simulation Modal */}
      <Modal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        title="Web QR Scanner Interface"
        description={`Authorized attendance scanner for: ${activeEventTitle}`}
      >
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/20">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 text-[#027013] flex items-center justify-center mb-3 dark:bg-emerald-900/60 dark:text-emerald-300">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
              Camera Ready for ID Barcode / QR Scan
            </p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
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
