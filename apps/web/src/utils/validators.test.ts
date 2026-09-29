import { describe, expect, it } from 'vitest';
import type { EventTimeWindows } from '@/lib/definitions';
import {
  validateEventTimeWindows,
  validateFineAmount,
  validateStudentId,
} from './validators';

describe('validateEventTimeWindows', () => {
  const validWindows: EventTimeWindows = {
    event_start: '2026-10-01T08:00:00Z',
    event_end: '2026-10-01T17:00:00Z',
    attendance_in_start: '2026-10-01T07:30:00Z',
    attendance_in_end: '2026-10-01T08:30:00Z',
    attendance_out_start: '2026-10-01T16:30:00Z',
    attendance_out_end: '2026-10-01T17:30:00Z',
    officer_in_start: '2026-10-01T07:00:00Z',
    officer_in_end: '2026-10-01T07:30:00Z',
    officer_out_start: '2026-10-01T17:30:00Z',
    officer_out_end: '2026-10-01T18:00:00Z',
  };

  it('approves a consistent set of event time windows', () => {
    const result = validateEventTimeWindows(validWindows);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects when event start is after event end', () => {
    const invalid = {
      ...validWindows,
      event_start: '2026-10-01T18:00:00Z',
      event_end: '2026-10-01T08:00:00Z',
    };
    const result = validateEventTimeWindows(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Event start time must be earlier than the event end time.'
    );
  });

  it('rejects when officer call-time starts after attendee time-in', () => {
    const invalid = {
      ...validWindows,
      officer_in_start: '2026-10-01T07:45:00Z',
      attendance_in_start: '2026-10-01T07:30:00Z',
    };
    const result = validateEventTimeWindows(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Officer call-time start must precede or coincide with attendee Time-In start.'
    );
  });

  it('rejects when officer egress ends before attendee time-out ends', () => {
    const invalid = {
      ...validWindows,
      attendance_out_end: '2026-10-01T18:00:00Z',
      officer_out_end: '2026-10-01T17:30:00Z',
    };
    const result = validateEventTimeWindows(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Officer egress cut-off must be equal to or later than attendee Time-Out cut-off.'
    );
  });

  it('catches invalid date strings', () => {
    const invalid = {
      ...validWindows,
      event_start: 'not-a-date',
    };
    const result = validateEventTimeWindows(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('invalid dates');
  });
});

describe('validateFineAmount', () => {
  it('approves standard non-negative amounts', () => {
    expect(validateFineAmount(0).isValid).toBe(true);
    expect(validateFineAmount(50.5).isValid).toBe(true);
    expect(validateFineAmount(500).isValid).toBe(true);
  });

  it('rejects negative numbers and amounts over ceiling', () => {
    expect(validateFineAmount(-10).isValid).toBe(false);
    expect(validateFineAmount(15000).isValid).toBe(false);
    expect(validateFineAmount(NaN).isValid).toBe(false);
  });
});

describe('validateStudentId', () => {
  it('validates common student ID patterns', () => {
    expect(validateStudentId('21-1234-567')).toBe(true);
    expect(validateStudentId('2024-001')).toBe(true);
    expect(validateStudentId('STU12345')).toBe(true);
  });

  it('rejects empty or invalid characters', () => {
    expect(validateStudentId('')).toBe(false);
    expect(validateStudentId('a')).toBe(false); // too short
    expect(validateStudentId('21@1234')).toBe(false); // invalid symbol
  });
});
