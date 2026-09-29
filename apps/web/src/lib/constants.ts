/**
 * System-wide constants, academic configurations, and route helpers
 * for the HNU DASH web application.
 */

import type { AttendanceStatus, GlobalSystemRole, TenantMemberRole } from './definitions';

export const ACADEMIC_YEAR_LEVELS = [1, 2, 3, 4, 5] as const;

export const SAMPLE_COURSES = [
  'BSIT', // BS Information Technology
  'BSCS', // BS Computer Science
  'BSIS', // BS Information Systems
  'BSA',  // BS Accountancy
  'BSBA', // BS Business Administration
  'BSN',  // BS Nursing
  'BEED', // Bachelor of Elementary Education
  'BSED', // Bachelor of Secondary Education
] as const;

export const DEFAULT_FINE_STUDENT = 50.0; // ₱50.00 per missed scan
export const DEFAULT_FINE_OFFICER = 100.0; // ₱100.00 per missed scan

export const ROUTES = {
  HOME: '/',
  PORTAL_DASHBOARD: '/portal',
  PORTAL_CALENDAR: '/portal/calendar',
  PORTAL_ATTENDANCE: '/portal/attendance',
  ORG_DASHBOARD: (orgId: string) => `/orgs/${orgId}`,
  ORG_EVENTS: (orgId: string) => `/orgs/${orgId}/events`,
  ORG_NEW_EVENT: (orgId: string) => `/orgs/${orgId}/events/new`,
  ORG_EVENT_DETAIL: (orgId: string, eventId: string) => `/orgs/${orgId}/events/${eventId}`,
  ORG_EVENT_SCANNERS: (orgId: string, eventId: string) => `/orgs/${orgId}/events/${eventId}/scanners`,
  ORG_EVENT_REVIEW: (orgId: string, eventId: string) => `/orgs/${orgId}/events/${eventId}/review`,
  ORG_MEMBERS: (orgId: string) => `/orgs/${orgId}/members`,
  ADVISER_ORGS: '/adviser/organizations',
  SCANNER: (eventId: string) => `/scanner/${eventId}`,
} as const;

export const TENANT_ROLE_CONFIG: Record<
  TenantMemberRole,
  { label: string; badgeClass: string; description: string }
> = {
  admin: {
    label: 'Admin',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Manages events, scanner assignments, and attendance records',
  },
  officer: {
    label: 'Officer',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Eligible for scanner duty and subject to officer call-times',
  },
  student: {
    label: 'Member',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Regular organization member and event attendee',
  },
};

export const GLOBAL_ROLE_CONFIG: Record<
  GlobalSystemRole,
  { label: string; badgeClass: string }
> = {
  admin: {
    label: 'Faculty Adviser',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  student: {
    label: 'Student',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

export const ATTENDANCE_STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; badgeClass: string }
> = {
  present: {
    label: 'Present',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  late: {
    label: 'Late',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  excused: {
    label: 'Excused',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
};
