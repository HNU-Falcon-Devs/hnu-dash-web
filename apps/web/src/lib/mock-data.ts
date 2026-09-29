/**
 * Realistic multi-tenant mock data and test personas for HNU DASH.
 * Conforms strictly to definitions in src/lib/definitions.ts.
 */

import type {
  EventWithDetails,
  Organization,
  Persona,
  Profile,
  StudentAttendanceRecord,
} from './definitions';

// ==========================================
// 1. Organizations (Tenants)
// ==========================================

export const MOCK_ORGANIZATIONS: Record<string, Organization> = {
  ccs: {
    id: 'org-ccs-001',
    name: 'College of Computer Studies Student Council',
    code: 'CCS',
    description: 'The supreme student governing council of the College of Computer Studies.',
    created_at: '2026-01-10T00:00:00Z',
  },
  sycomp: {
    id: 'org-sycomp-002',
    name: 'Society of Young Computer Professionals',
    code: 'SYCOMP',
    description: 'The premier academic organization for Information Technology and Computer Science majors.',
    created_at: '2026-01-15T00:00:00Z',
  },
  glee: {
    id: 'org-glee-003',
    name: 'University Glee Club',
    code: 'GLEE',
    description: 'Official university chorale performing at institutional events and competitions.',
    created_at: '2026-02-01T00:00:00Z',
  },
};

// ==========================================
// 2. Profiles
// ==========================================

export const MOCK_PROFILES: Record<string, Profile> = {
  juan: {
    id: 'usr-juan-101',
    student_id: '21-1234-567',
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    course: 'BSIT',
    year_level: 3,
    role: 'student',
    created_at: '2026-01-01T00:00:00Z',
  },
  maria: {
    id: 'usr-maria-102',
    student_id: '22-5678-890',
    first_name: 'Maria',
    last_name: 'Santos',
    course: 'BSCS',
    year_level: 2,
    role: 'student',
    created_at: '2026-01-05T00:00:00Z',
  },
  adviser: {
    id: 'usr-adviser-999',
    student_id: 'FAC-0042',
    first_name: 'Dr. Arthur',
    last_name: 'Pendelton',
    course: 'CCS-FACULTY',
    year_level: 5,
    role: 'admin', // Global Faculty Adviser
    created_at: '2025-08-01T00:00:00Z',
  },
};

// ==========================================
// 3. Test Personas
// ==========================================

export const MOCK_PERSONAS: Persona[] = [
  {
    id: 'persona-juan',
    label: 'Juan Dela Cruz (Dual-Role Student)',
    description: 'Admin in CCS Council, Officer in SYCOMP, Member in Glee Club.',
    profile: MOCK_PROFILES.juan,
    assigned_event_ids: ['event-ccs-01'], // Assigned scanner for CCS General Assembly
    memberships: [
      {
        organization: MOCK_ORGANIZATIONS.ccs,
        member_role: 'admin',
        joined_at: '2026-01-10T00:00:00Z',
      },
      {
        organization: MOCK_ORGANIZATIONS.sycomp,
        member_role: 'officer',
        joined_at: '2026-01-15T00:00:00Z',
      },
      {
        organization: MOCK_ORGANIZATIONS.glee,
        member_role: 'student',
        joined_at: '2026-02-05T00:00:00Z',
      },
    ],
  },
  {
    id: 'persona-maria',
    label: 'Maria Santos (Regular Student)',
    description: 'Member in CCS Council and SYCOMP. No administrative or scanning roles.',
    profile: MOCK_PROFILES.maria,
    assigned_event_ids: [],
    memberships: [
      {
        organization: MOCK_ORGANIZATIONS.ccs,
        member_role: 'student',
        joined_at: '2026-01-12T00:00:00Z',
      },
      {
        organization: MOCK_ORGANIZATIONS.sycomp,
        member_role: 'student',
        joined_at: '2026-01-20T00:00:00Z',
      },
    ],
  },
  {
    id: 'persona-adviser',
    label: 'Dr. Arthur Pendelton (Faculty Adviser)',
    description: 'Superadmin with platform-wide authority. Appoints student admins.',
    profile: MOCK_PROFILES.adviser,
    assigned_event_ids: [],
    memberships: [
      {
        organization: MOCK_ORGANIZATIONS.ccs,
        member_role: 'admin',
        joined_at: '2025-08-01T00:00:00Z',
      },
    ],
  },
];

// ==========================================
// 4. Sample Events
// ==========================================

export const MOCK_EVENTS: EventWithDetails[] = [
  {
    id: 'event-ccs-01',
    organization_id: MOCK_ORGANIZATIONS.ccs.id,
    organization: {
      id: MOCK_ORGANIZATIONS.ccs.id,
      name: MOCK_ORGANIZATIONS.ccs.name,
      code: MOCK_ORGANIZATIONS.ccs.code,
    },
    title: 'CCS Annual General Assembly 2026',
    description: 'Mandatory general orientation and departmental congress for all CCS students.',
    location: 'HNU Main Gymnasium',
    event_start: '2026-10-05T08:00:00Z',
    event_end: '2026-10-05T17:00:00Z',
    attendance_in_start: '2026-10-05T07:30:00Z',
    attendance_in_end: '2026-10-05T08:30:00Z',
    attendance_out_start: '2026-10-05T16:30:00Z',
    attendance_out_end: '2026-10-05T17:30:00Z',
    officer_in_start: '2026-10-05T06:45:00Z',
    officer_in_end: '2026-10-05T07:15:00Z',
    officer_out_start: '2026-10-05T17:30:00Z',
    officer_out_end: '2026-10-05T18:15:00Z',
    fine_per_missed_scan_student: 50.0,
    fine_per_missed_scan_officer: 100.0,
    target_year_levels: null, // All CCS members
    created_by: MOCK_PROFILES.juan.id,
    created_at: '2026-09-15T00:00:00Z',
    assigned_scanners_count: 4,
    total_attendees_count: 412,
  },
  {
    id: 'event-sycomp-02',
    organization_id: MOCK_ORGANIZATIONS.sycomp.id,
    organization: {
      id: MOCK_ORGANIZATIONS.sycomp.id,
      name: MOCK_ORGANIZATIONS.sycomp.name,
      code: MOCK_ORGANIZATIONS.sycomp.code,
    },
    title: 'Tech Summit & Hackathon Kickoff',
    description: 'Industry keynote, web development workshops, and project showcases.',
    location: 'Fr. Janssen Hall, Audio-Visual Center',
    event_start: '2026-10-12T13:00:00Z',
    event_end: '2026-10-12T18:00:00Z',
    attendance_in_start: '2026-10-12T12:30:00Z',
    attendance_in_end: '2026-10-12T13:30:00Z',
    attendance_out_start: '2026-10-12T17:30:00Z',
    attendance_out_end: '2026-10-12T18:30:00Z',
    officer_in_start: '2026-10-12T11:45:00Z',
    officer_in_end: '2026-10-12T12:15:00Z',
    officer_out_start: '2026-10-12T18:30:00Z',
    officer_out_end: '2026-10-12T19:00:00Z',
    fine_per_missed_scan_student: 30.0,
    fine_per_missed_scan_officer: 75.0,
    target_year_levels: [2, 3, 4], // 2nd to 4th year
    created_by: MOCK_PROFILES.juan.id,
    created_at: '2026-09-18T00:00:00Z',
    assigned_scanners_count: 2,
    total_attendees_count: 185,
  },
  {
    id: 'event-glee-03',
    organization_id: MOCK_ORGANIZATIONS.glee.id,
    organization: {
      id: MOCK_ORGANIZATIONS.glee.id,
      name: MOCK_ORGANIZATIONS.glee.name,
      code: MOCK_ORGANIZATIONS.glee.code,
    },
    title: 'Mid-Semester Choral Rehearsal & Workshop',
    description: 'Vocal coaching and rehearsal for the upcoming University Feast Day celebration.',
    location: 'Music Studio 2, St. Augustine Building',
    event_start: '2026-10-16T17:00:00Z',
    event_end: '2026-10-16T20:00:00Z',
    attendance_in_start: '2026-10-16T16:45:00Z',
    attendance_in_end: '2026-10-16T17:15:00Z',
    attendance_out_start: '2026-10-16T19:45:00Z',
    attendance_out_end: '2026-10-16T20:15:00Z',
    officer_in_start: '2026-10-16T16:30:00Z',
    officer_in_end: '2026-10-16T16:45:00Z',
    officer_out_start: '2026-10-16T20:15:00Z',
    officer_out_end: '2026-10-16T20:45:00Z',
    fine_per_missed_scan_student: 20.0,
    fine_per_missed_scan_officer: 50.0,
    target_year_levels: null,
    created_by: 'usr-glee-officer',
    created_at: '2026-09-20T00:00:00Z',
    assigned_scanners_count: 1,
    total_attendees_count: 45,
  },
];

// ==========================================
// 5. Sample Student Attendance History
// ==========================================

export const MOCK_STUDENT_ATTENDANCE: StudentAttendanceRecord[] = [
  {
    event: MOCK_EVENTS[0], // CCS General Assembly
    time_in_log: {
      id: 'log-001',
      event_id: MOCK_EVENTS[0].id,
      student_id: MOCK_PROFILES.juan.id,
      scanned_by: 'usr-scanner-01',
      type: 'time_in',
      scanned_at: '2026-10-05T07:42:00Z',
      synced_at: '2026-10-05T07:42:05Z',
      status: 'present',
    },
    time_out_log: {
      id: 'log-002',
      event_id: MOCK_EVENTS[0].id,
      student_id: MOCK_PROFILES.juan.id,
      scanned_by: 'usr-scanner-02',
      type: 'time_out',
      scanned_at: '2026-10-05T17:05:00Z',
      synced_at: '2026-10-05T17:05:10Z',
      status: 'present',
    },
    fine_amount: 0.0,
    overall_status: 'completed',
  },
  {
    event: MOCK_EVENTS[1], // SYCOMP Tech Summit
    time_in_log: {
      id: 'log-003',
      event_id: MOCK_EVENTS[1].id,
      student_id: MOCK_PROFILES.juan.id,
      scanned_by: 'usr-scanner-01',
      type: 'time_in',
      scanned_at: '2026-10-12T12:55:00Z',
      synced_at: '2026-10-12T12:55:12Z',
      status: 'present',
    },
    time_out_log: null, // Missed time-out scan!
    fine_amount: 30.0,
    overall_status: 'partial',
  },
];
