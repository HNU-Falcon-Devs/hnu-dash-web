import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOrgPermissions } from './use-org-permissions';

describe('useOrgPermissions', () => {
  it('grants full management capabilities to organization admins', () => {
    const { result } = renderHook(() =>
      useOrgPermissions({
        memberRole: 'admin',
        globalRole: 'student',
        assignedEventIds: [],
      })
    );

    expect(result.current.canManageEvents).toBe(true);
    expect(result.current.canAssignScanners).toBe(true);
    expect(result.current.canReviewAttendance).toBe(true);
    expect(result.current.canFinalizeEvent).toBe(true);
    expect(result.current.canViewAnalytics).toBe(true);
    expect(result.current.canViewReports).toBe(true);
    expect(result.current.canScanEvent('event-123')).toBe(true);
  });

  it('restricts officers from scanning events they are NOT assigned to and denies admin reports', () => {
    const { result } = renderHook(() =>
      useOrgPermissions({
        memberRole: 'officer',
        globalRole: 'student',
        assignedEventIds: ['event-assigned-01'],
      })
    );

    expect(result.current.canManageEvents).toBe(false);
    expect(result.current.canAssignScanners).toBe(false);
    expect(result.current.canReviewAttendance).toBe(false);
    expect(result.current.canViewAnalytics).toBe(false);
    expect(result.current.canViewReports).toBe(false);
    // Allowed on the assigned event:
    expect(result.current.canScanEvent('event-assigned-01')).toBe(true);
    // Disallowed on unassigned events:
    expect(result.current.canScanEvent('event-other-99')).toBe(false);
  });

  it('denies management, reports, and scanning permissions to regular student members', () => {
    const { result } = renderHook(() =>
      useOrgPermissions({
        memberRole: 'student',
        globalRole: 'student',
        assignedEventIds: ['event-123'], // Even if mistakenly in array, student role cannot scan
      })
    );

    expect(result.current.canManageEvents).toBe(false);
    expect(result.current.canAssignScanners).toBe(false);
    expect(result.current.canViewAnalytics).toBe(false);
    expect(result.current.canViewReports).toBe(false);
    expect(result.current.canScanEvent('event-123')).toBe(false);
  });

  it('grants platform-wide management to Faculty Advisers (global admin)', () => {
    const { result } = renderHook(() =>
      useOrgPermissions({
        memberRole: 'student', // Even if student member in a club
        globalRole: 'admin',   // Global faculty adviser
        assignedEventIds: [],
      })
    );

    expect(result.current.canManageEvents).toBe(true);
    expect(result.current.canAssignScanners).toBe(true);
    expect(result.current.canViewAnalytics).toBe(true);
    expect(result.current.canViewReports).toBe(true);
    expect(result.current.canScanEvent('any-event')).toBe(true);
  });
});
