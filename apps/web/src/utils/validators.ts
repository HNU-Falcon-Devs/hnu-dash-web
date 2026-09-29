/**
 * Business rule validators for event time-windows, fine amounts,
 * and form input constraints.
 */

import type { EventTimeWindows } from '@/lib/definitions';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates the chronological consistency of all event time windows:
 * - Event start precedes event end.
 * - Attendance in window is valid and completes before attendance out.
 * - Officer call time begins before or with attendee time-in.
 * - Officer egress window extends until or after attendee time-out.
 */
export function validateEventTimeWindows(windows: EventTimeWindows): ValidationResult {
  const errors: string[] = [];

  const parse = (iso: string) => new Date(iso).getTime();

  const eventStart = parse(windows.event_start);
  const eventEnd = parse(windows.event_end);
  const attInStart = parse(windows.attendance_in_start);
  const attInEnd = parse(windows.attendance_in_end);
  const attOutStart = parse(windows.attendance_out_start);
  const attOutEnd = parse(windows.attendance_out_end);
  const offInStart = parse(windows.officer_in_start);
  const offInEnd = parse(windows.officer_in_end);
  const offOutStart = parse(windows.officer_out_start);
  const offOutEnd = parse(windows.officer_out_end);

  // Check for any invalid date
  const timestamps = [
    eventStart, eventEnd,
    attInStart, attInEnd,
    attOutStart, attOutEnd,
    offInStart, offInEnd,
    offOutStart, offOutEnd,
  ];

  if (timestamps.some((t) => isNaN(t))) {
    return {
      isValid: false,
      errors: ['One or more time-window timestamps are invalid dates.'],
    };
  }

  // 1. Overall event boundaries
  if (eventStart >= eventEnd) {
    errors.push('Event start time must be earlier than the event end time.');
  }

  // 2. Attendee Time-In window
  if (attInStart >= attInEnd) {
    errors.push('Attendee Time-In start must be earlier than Time-In cut-off.');
  }

  // 3. Attendee Time-Out window
  if (attOutStart >= attOutEnd) {
    errors.push('Attendee Time-Out start must be earlier than Time-Out cut-off.');
  }

  // 4. Time-In vs Time-Out ordering
  if (attInEnd > attOutStart) {
    errors.push('Attendee Time-In cut-off cannot be later than Time-Out start.');
  }

  // 5. Officer Call-Time window
  if (offInStart >= offInEnd) {
    errors.push('Officer Call-Time start must be earlier than Call-Time cut-off.');
  }

  // 6. Officer Egress window
  if (offOutStart >= offOutEnd) {
    errors.push('Officer Egress start must be earlier than Egress cut-off.');
  }

  // 7. Officer arrival precedes attendee time-in
  if (offInStart > attInStart) {
    errors.push('Officer call-time start must precede or coincide with attendee Time-In start.');
  }

  // 8. Officer egress covers attendee time-out
  if (attOutEnd > offOutEnd) {
    errors.push('Officer egress cut-off must be equal to or later than attendee Time-Out cut-off.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates fine amount inputs.
 */
export function validateFineAmount(amount: number): { isValid: boolean; error?: string } {
  if (!Number.isFinite(amount)) {
    return { isValid: false, error: 'Fine must be a valid number.' };
  }
  if (amount < 0) {
    return { isValid: false, error: 'Fine amount cannot be negative.' };
  }
  if (amount > 10000) {
    return { isValid: false, error: 'Fine amount cannot exceed ₱10,000.00.' };
  }
  return { isValid: true };
}

/**
 * Validates scannable student ID format (non-empty string with alphanumeric and dashes).
 */
export function validateStudentId(studentId: string): boolean {
  if (!studentId || typeof studentId !== 'string') return false;
  const trimmed = studentId.trim();
  // Validates formats like "21-1234-567" or "202100123"
  return /^[A-Za-z0-9-]{4,30}$/.test(trimmed);
}
