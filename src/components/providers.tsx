'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from '@/context/theme-context';

export function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
