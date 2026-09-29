/**
 * Action mutations for event management, scanner delegation,
 * and attendance review overrides.
 */

import type {
  AttendanceStatus,
  EventWithDetails,
  EventTimeWindows,
} from '@/lib/definitions';
import { validateEventTimeWindows } from '@/utils/validators';
import {
  addMockEvent,
  getAssignedScannersForEvent,
  updateMockAssignedScanners,
  updateMockAttendanceLogStatus,
} from '@/supabase/data/events';

export interface CreateEventInput extends EventTimeWindows {
  organization_id: string;
  organization_name: string;
  organization_code: string;
  title: string;
  description: string;
  location: string;
  fine_per_missed_scan_student: number;
  fine_per_missed_scan_officer: number;
  target_year_levels: number[] | null;
  created_by: string;
}

export function createEventAction(input: CreateEventInput): {
  success: boolean;
  event?: EventWithDetails;
  errors?: string[];
} {
  // Validate time windows
  const validation = validateEventTimeWindows(input);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  if (!input.title.trim()) {
    return { success: false, errors: ['Event title is required.'] };
  }

  if (!input.location.trim()) {
    return { success: false, errors: ['Event location is required.'] };
  }

  const newEvent: EventWithDetails = {
    id: `event-${Date.now()}`,
    organization_id: input.organization_id,
    organization: {
      id: input.organization_id,
      name: input.organization_name,
      code: input.organization_code,
    },
    title: input.title.trim(),
    description: input.description.trim() || null,
    location: input.location.trim(),
    event_start: input.event_start,
    event_end: input.event_end,
    attendance_in_start: input.attendance_in_start,
    attendance_in_end: input.attendance_in_end,
    attendance_out_start: input.attendance_out_start,
    attendance_out_end: input.attendance_out_end,
    officer_in_start: input.officer_in_start,
    officer_in_end: input.officer_in_end,
    officer_out_start: input.officer_out_start,
    officer_out_end: input.officer_out_end,
    fine_per_missed_scan_student: input.fine_per_missed_scan_student,
    fine_per_missed_scan_officer: input.fine_per_missed_scan_officer,
    target_year_levels: input.target_year_levels,
    created_by: input.created_by,
    created_at: new Date().toISOString(),
    assigned_scanners_count: 0,
    total_attendees_count: 0,
  };

  addMockEvent(newEvent);

  return { success: true, event: newEvent };
}

/**
 * Delegates or revokes scanner authority for a specific officer and event.
 */
export function toggleScannerDutyAction(
  eventId: string,
  userId: string,
  assign: boolean
): { success: boolean; assignedScanners: string[] } {
  const current = getAssignedScannersForEvent(eventId);
  let updated: string[];

  if (assign) {
    updated = Array.from(new Set([...current, userId]));
  } else {
    updated = current.filter((id) => id !== userId);
  }

  updateMockAssignedScanners(eventId, updated);
  return { success: true, assignedScanners: updated };
}

/**
 * Manually updates the attendance status in scan logs (e.g. marking excused).
 */
export function overrideAttendanceStatusAction(
  logId: string,
  newStatus: AttendanceStatus
): { success: boolean } {
  updateMockAttendanceLogStatus(logId, newStatus);
  return { success: true };
}
