'use client';

import React from 'react';
import { AuthProvider } from '@/context/auth-context';
import { OrgProvider } from '@/context/org-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OrgProvider>{children}</OrgProvider>
    </AuthProvider>
  );
}
