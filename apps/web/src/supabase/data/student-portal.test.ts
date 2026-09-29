import { describe, expect, it } from 'vitest';
import {
  getStudentAttendanceRecords,
  getStudentClearanceStatus,
  getStudentUpcomingEvents,
} from './student-portal';
import { MOCK_PERSONAS, MOCK_PROFILES } from '@/lib/mock-data';

describe('student-portal data provider', () => {
  it('returns attendance records with computed fines for Maria Santos', () => {
    const records = getStudentAttendanceRecords(MOCK_PROFILES.maria.id);
    expect(records.length).toBeGreaterThanOrEqual(2);

    // Maria missed the SYCOMP event and incurred 2 missed scans fine
    const missedRecord = records.find((r) => r.overall_status === 'missed');
    expect(missedRecord).toBeDefined();
    expect(missedRecord?.fine_amount).toBe(60); // 2 * 30
  });

  it('calculates multi-tenant clearance status correctly', () => {
    const mariaPersona = MOCK_PERSONAS.find((p) => p.profile.id === MOCK_PROFILES.maria.id)!;
    const clearance = getStudentClearanceStatus(
      mariaPersona.profile,
      mariaPersona.memberships
    );

    expect(clearance.student.id).toBe(MOCK_PROFILES.maria.id);
    expect(clearance.overall_status).toBe('action_required');
    expect(clearance.total_fines).toBe(60);
    expect(clearance.organization_breakdowns.length).toBe(mariaPersona.memberships.length);

    // CCS should be cleared (fine 0)
    const ccsBreakdown = clearance.organization_breakdowns.find(
      (b) => b.organization.code === 'CCS'
    );
    expect(ccsBreakdown?.status).toBe('cleared');
    expect(ccsBreakdown?.total_fines).toBe(0);

    // SYCOMP should have pending fines
    const sycompBreakdown = clearance.organization_breakdowns.find(
      (b) => b.organization.code === 'SYCOMP'
    );
    expect(sycompBreakdown?.status).toBe('pending_fines');
    expect(sycompBreakdown?.total_fines).toBe(60);
  });

  it('filters upcoming events by enrolled organizations and year level', () => {
    // Maria is Year 2, enrolled in CCS and SYCOMP
    const enrolledOrgIds = [
      MOCK_PERSONAS[1].memberships[0].organization.id,
      MOCK_PERSONAS[1].memberships[1].organization.id,
    ];

    const upcomingEvents = getStudentUpcomingEvents(2, enrolledOrgIds);
    expect(upcomingEvents.length).toBeGreaterThanOrEqual(1);

    // Events should only belong to CCS or SYCOMP, not Glee Club
    upcomingEvents.forEach((event) => {
      expect(enrolledOrgIds).toContain(event.organization_id);
    });
  });
});
