/**
 * Data fetcher functions for events, officers, scanners, and attendance logs.
 * Scoped to organization boundaries.
 */

import type {
  AttendanceLog,
  EventWithDetails,
  Profile,
} from '@/lib/definitions';
import {
  MOCK_EVENTS,
  MOCK_PROFILES,
} from '@/lib/mock-data';

// Mock in-memory state for Phase 3 interactions
let mockEventsState: EventWithDetails[] = [...MOCK_EVENTS];

// Map of eventId -> array of assigned officer userIds
const mockAssignedScannersState: Record<string, string[]> = {
  'event-ccs-01': [MOCK_PROFILES.juan.id],
  'event-sycomp-02': [MOCK_PROFILES.juan.id],
  'event-glee-03': [],
};

// Map of eventId -> array of attendance logs
let mockAttendanceLogsState: AttendanceLog[] = [
  {
    id: 'log-101',
    event_id: 'event-ccs-01',
    student_id: MOCK_PROFILES.maria.id,
    scanned_by: MOCK_PROFILES.juan.id,
    type: 'time_in',
    scanned_at: '2026-10-05T07:45:00Z',
    synced_at: '2026-10-05T07:45:06Z',
    status: 'present',
  },
  {
    id: 'log-102',
    event_id: 'event-ccs-01',
    student_id: MOCK_PROFILES.maria.id,
    scanned_by: MOCK_PROFILES.juan.id,
    type: 'time_out',
    scanned_at: '2026-10-05T17:10:00Z',
    synced_at: '2026-10-05T17:10:11Z',
    status: 'present',
  },
  {
    id: 'log-103',
    event_id: 'event-ccs-01',
    student_id: 'usr-student-03',
    scanned_by: MOCK_PROFILES.juan.id,
    type: 'time_in',
    scanned_at: '2026-10-05T08:20:00Z',
    synced_at: '2026-10-05T08:20:04Z',
    status: 'late',
  },
];

export function getEventsByOrg(orgId: string): EventWithDetails[] {
  return mockEventsState.filter((e) => e.organization_id === orgId);
}

export function getAllEvents(): EventWithDetails[] {
  return mockEventsState;
}

/**
 * Returns eligible officers in the organization who can be delegated scanner duty.
 */
export function getEligibleOfficersForOrg(orgCode: string): Profile[] {
  // In real Supabase integration, queries organization_members where role IN ('officer', 'admin')
  if (orgCode === 'CCS') {
    return [
      MOCK_PROFILES.juan,
      {
        id: 'usr-officer-ccs-2',
        student_id: '22-3344-556',
        first_name: 'Christian',
        last_name: 'Vargas',
        course: 'BSCS',
        year_level: 3,
        role: 'student',
        created_at: '2026-01-10T00:00:00Z',
      },
      {
        id: 'usr-officer-ccs-3',
        student_id: '23-7788-990',
        first_name: 'Angelica',
        last_name: 'Ramos',
        course: 'BSIT',
        year_level: 2,
        role: 'student',
        created_at: '2026-01-12T00:00:00Z',
      },
    ];
  }

  if (orgCode === 'SYCOMP') {
    return [
      MOCK_PROFILES.juan,
      {
        id: 'usr-officer-sycomp-2',
        student_id: '21-9988-776',
        first_name: 'Rico',
        last_name: 'Suarez',
        course: 'BSIT',
        year_level: 4,
        role: 'student',
        created_at: '2026-01-15T00:00:00Z',
      },
    ];
  }

  return [];
}

/**
 * Retrieves the list of officer user IDs delegated to scan for a specific event.
 */
export function getAssignedScannersForEvent(eventId: string): string[] {
  return mockAssignedScannersState[eventId] || [];
}

/**
 * Retrieves scan transactions for an event.
 */
export function getAttendanceLogsForEvent(eventId: string): AttendanceLog[] {
  return mockAttendanceLogsState.filter((log) => log.event_id === eventId);
}

/**
 * Mutates in-memory event state (for development / mock mode).
 */
export function addMockEvent(event: EventWithDetails) {
  mockEventsState = [event, ...mockEventsState];
}

export function updateMockAssignedScanners(
  eventId: string,
  assignedUserIds: string[]
) {
  mockAssignedScannersState[eventId] = assignedUserIds;
}

export function updateMockAttendanceLogStatus(
  logId: string,
  newStatus: AttendanceLog['status']
) {
  mockAttendanceLogsState = mockAttendanceLogsState.map((log) =>
    log.id === logId ? { ...log, status: newStatus } : log
  );
}
