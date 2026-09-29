/**
 * Student Portal data provider for multi-tenant attendance history,
 * fine breakdowns, and semester clearance verification.
 */

import type {
  EventWithDetails,
  OrganizationClearanceSummary,
  Profile,
  StudentAttendanceRecord,
  StudentClearanceStatus,
  UserOrganizationMembership,
} from '@/lib/definitions';
import { getAllEvents } from '@/supabase/data/events';
import { MOCK_PROFILES } from '@/lib/mock-data';

// In-memory student attendance records keyed by user ID
const mockStudentAttendanceMap: Record<string, StudentAttendanceRecord[]> = {};

function initMockStudentAttendance() {
  const events = getAllEvents();
  const ccsEvent = events.find((e) => e.organization.code === 'CCS') || events[0];
  const sycompEvent = events.find((e) => e.organization.code === 'SYCOMP') || events[1] || events[0];
  const gleeEvent = events.find((e) => e.organization.code === 'GLEE') || events[2] || events[0];

  // Juan Dela Cruz (Dual-role officer/admin): Partial attendance in SYCOMP
  mockStudentAttendanceMap[MOCK_PROFILES.juan.id] = [
    {
      event: ccsEvent,
      time_in_log: {
        id: 'log-juan-01',
        event_id: ccsEvent.id,
        student_id: MOCK_PROFILES.juan.id,
        scanned_by: 'usr-scanner-ccs',
        type: 'time_in',
        scanned_at: '2026-10-05T07:42:00Z',
        synced_at: '2026-10-05T07:42:05Z',
        status: 'present',
      },
      time_out_log: {
        id: 'log-juan-02',
        event_id: ccsEvent.id,
        student_id: MOCK_PROFILES.juan.id,
        scanned_by: 'usr-scanner-ccs',
        type: 'time_out',
        scanned_at: '2026-10-05T17:05:00Z',
        synced_at: '2026-10-05T17:05:10Z',
        status: 'present',
      },
      fine_amount: 0.0,
      overall_status: 'completed',
    },
    {
      event: sycompEvent,
      time_in_log: {
        id: 'log-juan-03',
        event_id: sycompEvent.id,
        student_id: MOCK_PROFILES.juan.id,
        scanned_by: 'usr-scanner-sycomp',
        type: 'time_in',
        scanned_at: '2026-10-12T12:55:00Z',
        synced_at: '2026-10-12T12:55:12Z',
        status: 'present',
      },
      time_out_log: null, // Missed time-out scan!
      fine_amount: sycompEvent.fine_per_missed_scan_student,
      overall_status: 'partial',
    },
  ];

  // Maria Santos (Regular student): Attended CCS, missed SYCOMP, excused in Glee Club
  mockStudentAttendanceMap[MOCK_PROFILES.maria.id] = [
    {
      event: ccsEvent,
      time_in_log: {
        id: 'log-maria-01',
        event_id: ccsEvent.id,
        student_id: MOCK_PROFILES.maria.id,
        scanned_by: 'usr-scanner-ccs',
        type: 'time_in',
        scanned_at: '2026-10-05T07:40:00Z',
        synced_at: '2026-10-05T07:40:08Z',
        status: 'present',
      },
      time_out_log: {
        id: 'log-maria-02',
        event_id: ccsEvent.id,
        student_id: MOCK_PROFILES.maria.id,
        scanned_by: 'usr-scanner-ccs',
        type: 'time_out',
        scanned_at: '2026-10-05T17:15:00Z',
        synced_at: '2026-10-05T17:15:15Z',
        status: 'present',
      },
      fine_amount: 0.0,
      overall_status: 'completed',
    },
    {
      event: sycompEvent,
      time_in_log: null,
      time_out_log: null, // Missed both check-in and checkout scans
      fine_amount: sycompEvent.fine_per_missed_scan_student * 2, // 2 missed scans
      overall_status: 'missed',
    },
    {
      event: gleeEvent,
      time_in_log: {
        id: 'log-maria-03',
        event_id: gleeEvent.id,
        student_id: MOCK_PROFILES.maria.id,
        scanned_by: 'usr-scanner-glee',
        type: 'time_in',
        scanned_at: '2026-10-16T16:50:00Z',
        synced_at: '2026-10-16T16:50:11Z',
        status: 'excused',
      },
      time_out_log: {
        id: 'log-maria-04',
        event_id: gleeEvent.id,
        student_id: MOCK_PROFILES.maria.id,
        scanned_by: 'usr-scanner-glee',
        type: 'time_out',
        scanned_at: '2026-10-16T20:00:00Z',
        synced_at: '2026-10-16T20:00:15Z',
        status: 'excused',
      },
      fine_amount: 0.0,
      overall_status: 'excused',
    },
  ];
}

// Initialize on module load
initMockStudentAttendance();

/**
 * Returns all past/current event attendance logs and computed fine statuses for a student.
 */
export function getStudentAttendanceRecords(studentId: string): StudentAttendanceRecord[] {
  if (!mockStudentAttendanceMap[studentId]) {
    // Default fallback if student not explicitly mocked
    return [];
  }
  return mockStudentAttendanceMap[studentId];
}

/**
 * Aggregates attendance records across all enrolled organizations to determine clearance.
 */
export function getStudentClearanceStatus(
  student: Profile,
  memberships: UserOrganizationMembership[]
): StudentClearanceStatus {
  const attendanceRecords = getStudentAttendanceRecords(student.id);

  const breakdowns: OrganizationClearanceSummary[] = memberships.map((membership) => {
    const org = membership.organization;
    const orgRecords = attendanceRecords.filter((r) => r.event.organization_id === org.id);

    const totalEvents = orgRecords.length;
    const attendedEvents = orgRecords.filter(
      (r) => r.overall_status === 'completed' || r.overall_status === 'excused'
    ).length;
    const missedEvents = orgRecords.filter(
      (r) => r.overall_status === 'missed' || r.overall_status === 'partial'
    ).length;
    const totalFines = orgRecords.reduce((acc, r) => acc + r.fine_amount, 0);

    return {
      organization: {
        id: org.id,
        name: org.name,
        code: org.code,
      },
      total_events: totalEvents,
      attended_events: attendedEvents,
      missed_events: missedEvents,
      total_fines: totalFines,
      status: totalFines === 0 ? 'cleared' : 'pending_fines',
    };
  });

  const totalOutstandingFines = breakdowns.reduce((acc, b) => acc + b.total_fines, 0);

  return {
    student,
    overall_status: totalOutstandingFines === 0 ? 'cleared' : 'action_required',
    total_fines: totalOutstandingFines,
    organization_breakdowns: breakdowns,
  };
}

/**
 * Retrieves upcoming events matching the student's enrolled organizations.
 */
export function getStudentUpcomingEvents(
  studentYearLevel: number,
  enrolledOrgIds: string[]
): EventWithDetails[] {
  const allEvents = getAllEvents();

  return allEvents.filter((event) => {
    // Must belong to an organization the student is enrolled in
    if (!enrolledOrgIds.includes(event.organization_id)) {
      return false;
    }

    // Check year level eligibility if targeted
    if (event.target_year_levels && event.target_year_levels.length > 0) {
      return event.target_year_levels.includes(studentYearLevel);
    }

    return true;
  });
}
