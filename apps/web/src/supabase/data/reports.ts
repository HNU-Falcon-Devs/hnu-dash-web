/**
 * Organization attendance analytics and master attendance report generator.
 * Produces authoritative event rosters and executive compliance summaries.
 */

import type {
  MasterAttendanceReport,
  MasterAttendeeRosterItem,
  Profile,
} from '@/lib/definitions';
import { getAllEvents } from '@/supabase/data/events';
import { MOCK_PROFILES } from '@/lib/mock-data';

export interface OrganizationAnalytics {
  orgId: string;
  totalEvents: number;
  totalActiveMembers: number;
  overallAttendanceRate: number;
  totalFinesIncurred: number;
  totalFinesCollected: number;
  totalFinesPending: number;
  punctualityBreakdown: {
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
}

// Realistic student sample population for master reports
const SAMPLE_STUDENTS: Profile[] = [
  MOCK_PROFILES.maria,
  MOCK_PROFILES.juan,
  {
    id: 'usr-student-03',
    student_id: '22-1044-890',
    first_name: 'Christian',
    last_name: 'Vargas',
    course: 'BSCS',
    year_level: 3,
    role: 'student',
    created_at: '2026-01-10T00:00:00Z',
  },
  {
    id: 'usr-student-04',
    student_id: '23-2055-112',
    first_name: 'Angelica',
    last_name: 'Ramos',
    course: 'BSIT',
    year_level: 2,
    role: 'student',
    created_at: '2026-01-12T00:00:00Z',
  },
  {
    id: 'usr-student-05',
    student_id: '21-3066-223',
    first_name: 'Rico',
    last_name: 'Suarez',
    course: 'BSIT',
    year_level: 4,
    role: 'student',
    created_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'usr-student-06',
    student_id: '22-4077-334',
    first_name: 'Gabriel',
    last_name: 'Lim',
    course: 'BSCS',
    year_level: 2,
    role: 'student',
    created_at: '2026-01-18T00:00:00Z',
  },
  {
    id: 'usr-student-07',
    student_id: '23-5088-445',
    first_name: 'Patricia',
    last_name: 'Tan',
    course: 'BSIT',
    year_level: 1,
    role: 'student',
    created_at: '2026-01-20T00:00:00Z',
  },
  {
    id: 'usr-student-08',
    student_id: '21-6099-556',
    first_name: 'Kevin',
    last_name: 'Dizon',
    course: 'BSCS',
    year_level: 4,
    role: 'student',
    created_at: '2026-01-22T00:00:00Z',
  },
  {
    id: 'usr-student-09',
    student_id: '22-7011-667',
    first_name: 'Bea',
    last_name: 'Alonzo',
    course: 'BSIT',
    year_level: 3,
    role: 'student',
    created_at: '2026-01-25T00:00:00Z',
  },
  {
    id: 'usr-student-10',
    student_id: '23-8022-778',
    first_name: 'Joshua',
    last_name: 'Garcia',
    course: 'BSCS',
    year_level: 1,
    role: 'student',
    created_at: '2026-01-28T00:00:00Z',
  },
];

/**
 * Compiles a full master attendance report for a specified event.
 */
export function getMasterAttendanceReport(eventId: string): MasterAttendanceReport {
  const events = getAllEvents();
  const event = events.find((e) => e.id === eventId) || events[0];

  const finePerScan = event.fine_per_missed_scan_student;

  const roster: MasterAttendeeRosterItem[] = SAMPLE_STUDENTS.map((student, idx) => {
    // Generate realistic, consistent attendee logs
    if (idx === 0 || idx === 1 || idx === 2 || idx === 4) {
      // Full Present (both check-in and checkout)
      return {
        student,
        time_in: {
          id: `log-in-${student.id}`,
          event_id: event.id,
          student_id: student.id,
          scanned_by: 'usr-scanner-01',
          type: 'time_in',
          scanned_at: '2026-10-05T07:42:00Z',
          synced_at: '2026-10-05T07:42:05Z',
          status: 'present',
        },
        time_out: {
          id: `log-out-${student.id}`,
          event_id: event.id,
          student_id: student.id,
          scanned_by: 'usr-scanner-02',
          type: 'time_out',
          scanned_at: '2026-10-05T17:05:00Z',
          synced_at: '2026-10-05T17:05:10Z',
          status: 'present',
        },
        overall_status: 'present',
        fine_amount: 0,
      };
    } else if (idx === 3 || idx === 5) {
      // Late Time-In, completed checkout
      return {
        student,
        time_in: {
          id: `log-in-${student.id}`,
          event_id: event.id,
          student_id: student.id,
          scanned_by: 'usr-scanner-01',
          type: 'time_in',
          scanned_at: '2026-10-05T08:25:00Z',
          synced_at: '2026-10-05T08:25:08Z',
          status: 'late',
        },
        time_out: {
          id: `log-out-${student.id}`,
          event_id: event.id,
          student_id: student.id,
          scanned_by: 'usr-scanner-02',
          type: 'time_out',
          scanned_at: '2026-10-05T17:10:00Z',
          synced_at: '2026-10-05T17:10:12Z',
          status: 'present',
        },
        overall_status: 'late',
        fine_amount: finePerScan * 0.5, // 50% tardiness fee
      };
    } else if (idx === 6) {
      // Official Excused Absence
      return {
        student,
        time_in: {
          id: `log-in-${student.id}`,
          event_id: event.id,
          student_id: student.id,
          scanned_by: 'usr-scanner-01',
          type: 'time_in',
          scanned_at: '2026-10-05T07:30:00Z',
          synced_at: '2026-10-05T07:30:05Z',
          status: 'excused',
        },
        time_out: {
          id: `log-out-${student.id}`,
          event_id: event.id,
          student_id: student.id,
          scanned_by: 'usr-scanner-02',
          type: 'time_out',
          scanned_at: '2026-10-05T17:30:00Z',
          synced_at: '2026-10-05T17:30:10Z',
          status: 'excused',
        },
        overall_status: 'excused',
        fine_amount: 0,
      };
    } else {
      // Absent / Missed Scans
      return {
        student,
        time_in: null,
        time_out: null,
        overall_status: 'absent',
        fine_amount: finePerScan * 2, // 2 missed scans
      };
    }
  });

  const totalEnrolled = roster.length;
  const totalPresent = roster.filter((r) => r.overall_status === 'present').length;
  const totalLate = roster.filter((r) => r.overall_status === 'late').length;
  const totalExcused = roster.filter((r) => r.overall_status === 'excused').length;
  const totalAbsent = roster.filter((r) => r.overall_status === 'absent').length;

  const attendedCount = totalPresent + totalLate + totalExcused;
  const attendanceRate = totalEnrolled > 0 ? (attendedCount / totalEnrolled) * 100 : 0;
  const totalFines = roster.reduce((sum, r) => sum + r.fine_amount, 0);

  return {
    event,
    total_enrolled: totalEnrolled,
    total_present: totalPresent,
    total_late: totalLate,
    total_excused: totalExcused,
    total_absent: totalAbsent,
    attendance_rate_percentage: Number(attendanceRate.toFixed(1)),
    total_fines_generated: totalFines,
    roster,
  };
}

/**
 * Returns executive analytics for an organization workspace.
 */
export function getOrganizationAnalytics(orgId: string): OrganizationAnalytics {
  const events = getAllEvents().filter((e) => e.organization_id === orgId);

  // Generate aggregate stats
  const totalEvents = events.length;
  const totalActiveMembers = SAMPLE_STUDENTS.length;

  return {
    orgId,
    totalEvents,
    totalActiveMembers,
    overallAttendanceRate: 85.0,
    totalFinesIncurred: 450.0,
    totalFinesCollected: 300.0,
    totalFinesPending: 150.0,
    punctualityBreakdown: {
      present: 40,
      late: 20,
      absent: 30,
      excused: 10,
    },
  };
}
