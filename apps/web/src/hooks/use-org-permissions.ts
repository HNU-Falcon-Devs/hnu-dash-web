/**
 * Capability resolution hook for multi-tenant role-based access control.
 * Replaces fragile inline string checks (e.g. org.role === 'admin')
 * with declarative, type-safe permission checks.
 */

import { useMemo } from 'react';
import type {
  GlobalSystemRole,
  OrgPermissions,
  TenantMemberRole,
} from '@/lib/definitions';

export interface UseOrgPermissionsOptions {
  memberRole?: TenantMemberRole | null;
  globalRole?: GlobalSystemRole | null;
  assignedEventIds?: string[];
}

export function useOrgPermissions({
  memberRole,
  globalRole,
  assignedEventIds = [],
}: UseOrgPermissionsOptions): OrgPermissions {
  return useMemo<OrgPermissions>(() => {
    const isGlobalAdmin = globalRole === 'admin';
    const isOrgAdmin = memberRole === 'admin';
    const isOfficer = memberRole === 'officer';

    // Global Adviser / Superadmin has administrative privileges across all orgs
    const hasAdminAuthority = isGlobalAdmin || isOrgAdmin;

    return {
      canManageEvents: hasAdminAuthority,
      canAssignScanners: hasAdminAuthority,
      canReviewAttendance: hasAdminAuthority,
      canFinalizeEvent: hasAdminAuthority,
      canViewAnalytics: hasAdminAuthority,
      canViewReports: hasAdminAuthority,

      /**
       * Strict scanner capability enforcement:
       * Officers can scan ONLY if explicitly assigned to the event in event_assigned_scanners.
       * Admins hold institutional scanning authority.
       */
      canScanEvent: (eventId: string) => {
        if (!eventId) return false;
        if (hasAdminAuthority) return true;
        if (isOfficer) {
          return assignedEventIds.includes(eventId);
        }
        return false;
      },
    };
  }, [memberRole, globalRole, assignedEventIds]);
}
