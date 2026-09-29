import { describe, expect, it } from 'vitest';
import {
  createEventAction,
  overrideAttendanceStatusAction,
  toggleScannerDutyAction,
} from './event-actions';
import {
  getAssignedScannersForEvent,
  getAttendanceLogsForEvent,
} from '../data/events';

describe('event-actions', () => {
  it('creates an event with valid time windows and fine parameters', () => {
    const result = createEventAction({
      organization_id: 'org-ccs-001',
      organization_name: 'College of Computer Studies',
      organization_code: 'CCS',
      title: 'HNU Hackathon 2026',
      description: 'Annual coding challenge',
      location: 'Computer Lab 1',
      event_start: '2026-11-01T08:00:00Z',
      event_end: '2026-11-01T17:00:00Z',
      attendance_in_start: '2026-11-01T07:30:00Z',
      attendance_in_end: '2026-11-01T08:30:00Z',
      attendance_out_start: '2026-11-01T16:30:00Z',
      attendance_out_end: '2026-11-01T17:30:00Z',
      officer_in_start: '2026-11-01T07:00:00Z',
      officer_in_end: '2026-11-01T07:30:00Z',
      officer_out_start: '2026-11-01T17:30:00Z',
      officer_out_end: '2026-11-01T18:00:00Z',
      fine_per_missed_scan_student: 50.0,
      fine_per_missed_scan_officer: 100.0,
      target_year_levels: [3, 4],
      created_by: 'usr-juan-101',
    });

    expect(result.success).toBe(true);
    expect(result.event).toBeDefined();
    expect(result.event?.title).toBe('HNU Hackathon 2026');
    expect(result.event?.target_year_levels).toEqual([3, 4]);
  });

  it('rejects event creation when time windows violate chronological constraints', () => {
    const result = createEventAction({
      organization_id: 'org-ccs-001',
      organization_name: 'College of Computer Studies',
      organization_code: 'CCS',
      title: 'Invalid Event',
      description: '',
      location: 'Hall A',
      event_start: '2026-11-01T17:00:00Z',
      event_end: '2026-11-01T08:00:00Z', // Inverted end date
      attendance_in_start: '2026-11-01T07:30:00Z',
      attendance_in_end: '2026-11-01T08:30:00Z',
      attendance_out_start: '2026-11-01T16:30:00Z',
      attendance_out_end: '2026-11-01T17:30:00Z',
      officer_in_start: '2026-11-01T07:00:00Z',
      officer_in_end: '2026-11-01T07:30:00Z',
      officer_out_start: '2026-11-01T17:30:00Z',
      officer_out_end: '2026-11-01T18:00:00Z',
      fine_per_missed_scan_student: 50,
      fine_per_missed_scan_officer: 100,
      target_year_levels: null,
      created_by: 'usr-juan-101',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toContain(
      'Event start time must be earlier than the event end time.'
    );
  });

  it('delegates and revokes officer scanner duty in event_assigned_scanners', () => {
    const eventId = 'event-ccs-01';
    const officerId = 'usr-officer-test-99';

    // Assign
    const assignRes = toggleScannerDutyAction(eventId, officerId, true);
    expect(assignRes.success).toBe(true);
    expect(getAssignedScannersForEvent(eventId)).toContain(officerId);

    // Revoke
    const revokeRes = toggleScannerDutyAction(eventId, officerId, false);
    expect(revokeRes.success).toBe(true);
    expect(getAssignedScannersForEvent(eventId)).not.toContain(officerId);
  });

  it('overrides attendance verification status in scan logs', () => {
    const eventId = 'event-ccs-01';
    const logs = getAttendanceLogsForEvent(eventId);
    const targetLog = logs[0];

    const res = overrideAttendanceStatusAction(targetLog.id, 'excused');
    expect(res.success).toBe(true);

    const updatedLogs = getAttendanceLogsForEvent(eventId);
    const updated = updatedLogs.find((l) => l.id === targetLog.id);
    expect(updated?.status).toBe('excused');
  });
});
