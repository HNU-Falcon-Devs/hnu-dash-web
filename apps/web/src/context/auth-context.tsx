'use client';

/**
 * Authentication and Persona Context for HNU DASH.
 * Provides user profile data, multi-tenant memberships,
 * and a development persona switcher to test different roles.
 */

import React, { createContext, useContext, useMemo, useState } from 'react';
import type {
  Persona,
  Profile,
  UserOrganizationMembership,
} from '@/lib/definitions';
import { MOCK_PERSONAS } from '@/lib/mock-data';

interface AuthContextValue {
  currentPersona: Persona;
  availablePersonas: Persona[];
  switchPersona: (personaId: string) => void;
  userProfile: Profile;
  userMemberships: UserOrganizationMembership[];
  assignedEventIds: string[];
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(
    MOCK_PERSONAS[0].id // Default to Juan Dela Cruz (Dual-Role Student)
  );

  const currentPersona = useMemo(() => {
    return (
      MOCK_PERSONAS.find((p) => p.id === selectedPersonaId) || MOCK_PERSONAS[0]
    );
  }, [selectedPersonaId]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      currentPersona,
      availablePersonas: MOCK_PERSONAS,
      switchPersona: (personaId: string) => setSelectedPersonaId(personaId),
      userProfile: currentPersona.profile,
      userMemberships: currentPersona.memberships,
      assignedEventIds: currentPersona.assigned_event_ids,
    };
  }, [currentPersona]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
