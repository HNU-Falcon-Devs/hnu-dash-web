'use client';

/**
 * Organization Context for HNU DASH.
 * Tracks the currently active organization workspace,
 * resolves role capabilities, and supports switching between
 * the Student Portal and specific Organization Admin dashboards.
 */

import React, { createContext, useContext, useMemo, useState } from 'react';
import type {
  OrgPermissions,
  UserOrganizationMembership,
} from '@/lib/definitions';
import { useOrgPermissions } from '@/hooks/use-org-permissions';
import { useAuth } from './auth-context';

interface OrgContextValue {
  activeOrgId: string | null;
  activeMembership: UserOrganizationMembership | null;
  selectOrg: (orgId: string | null) => void;
  permissions: OrgPermissions;
  isStudentPortalActive: boolean;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { userProfile, userMemberships, assignedEventIds } = useAuth();

  // null denotes the universal Student Portal is currently active
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  // If activeOrgId is set, find the user's membership in that organization
  const activeMembership = useMemo(() => {
    if (!activeOrgId) return null;
    return (
      userMemberships.find((m) => m.organization.id === activeOrgId) || null
    );
  }, [activeOrgId, userMemberships]);

  // Compute capabilities for the active workspace
  const permissions = useOrgPermissions({
    memberRole: activeMembership?.member_role,
    globalRole: userProfile.role,
    assignedEventIds,
  });

  const value = useMemo<OrgContextValue>(() => {
    return {
      activeOrgId,
      activeMembership,
      selectOrg: (orgId: string | null) => setActiveOrgId(orgId),
      permissions,
      isStudentPortalActive: activeOrgId === null,
    };
  }, [activeOrgId, activeMembership, permissions]);

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}
