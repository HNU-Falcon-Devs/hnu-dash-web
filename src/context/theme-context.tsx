'use client';

/**
 * Theme Context for HNU DASH.
 * Uses useSyncExternalStore for React 19 compliance, zero-cascading-render state,
 * and reliable light/dark/system mode resolution with defensive browser guards.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const THEME_STORAGE_KEY = 'hnu-dash-theme';

// Storage event listener for cross-component and cross-tab reactivity
function subscribeStorage(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getStoredThemeSnapshot(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // Ignore storage read errors
  }
  return 'system';
}

function getServerThemeSnapshot(): Theme {
  return 'system';
}

// Media query listener for OS dark mode changes with defensive check
function subscribeMediaQuery(callback: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getMediaSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getServerMediaSnapshot(): boolean {
  return false;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeStorage,
    getStoredThemeSnapshot,
    getServerThemeSnapshot
  );

  const systemPrefersDark = useSyncExternalStore(
    subscribeMediaQuery,
    getMediaSnapshot,
    getServerMediaSnapshot
  );

  const resolvedTheme: ResolvedTheme =
    theme === 'system' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  // Synchronize documentElement class with resolvedTheme
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      // Dispatch a synthetic storage event for immediate local subscriber update
      window.dispatchEvent(new Event('storage'));
    } catch {
      // Ignore storage write errors
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
