import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/context/theme-context';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle component', () => {
  beforeEach(() => {
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders theme options (Light, Dark, System)', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(screen.getByRole('radio', { name: /Light/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Dark/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /System/i })).toBeInTheDocument();
  });

  it('toggles theme when an option is clicked', () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const darkButton = screen.getByRole('radio', { name: /Dark/i });
    fireEvent.click(darkButton);

    expect(darkButton).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    const lightButton = screen.getByRole('radio', { name: /Light/i });
    fireEvent.click(lightButton);

    expect(lightButton).toHaveAttribute('aria-checked', 'true');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
