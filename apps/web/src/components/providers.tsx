'use client';

import React from 'react';
import { AuthProvider } from '@/context/auth-context';
import { OrgProvider } from '@/context/org-context';
import { ThemeProvider } from '@/context/theme-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <OrgProvider>{children}</OrgProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
