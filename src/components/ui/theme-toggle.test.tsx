import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/context/theme-context';
import { ThemeToggle } from './theme-toggle';

describe('ThemeToggle component', () => {
  beforeEach(() => {
    localStorage.clear();
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

  it('uses one tab stop and changes selection and focus with arrow keys, Home, and End', () => {
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);
    const light = screen.getByRole('radio', { name: 'Light' });
    const dark = screen.getByRole('radio', { name: 'Dark' });
    const system = screen.getByRole('radio', { name: 'System' });

    expect(system).toHaveAttribute('tabindex', '0');
    expect(light).toHaveAttribute('tabindex', '-1');
    expect(dark).toHaveAttribute('tabindex', '-1');

    system.focus();
    fireEvent.keyDown(system, { key: 'ArrowRight' });
    expect(light).toHaveFocus();
    expect(light).toHaveAttribute('aria-checked', 'true');
    expect(light).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(light, { key: 'ArrowLeft' });
    expect(system).toHaveFocus();
    expect(system).toHaveAttribute('aria-checked', 'true');

    fireEvent.keyDown(system, { key: 'Home' });
    expect(light).toHaveFocus();
    fireEvent.keyDown(light, { key: 'End' });
    expect(system).toHaveFocus();

    fireEvent.keyDown(system, { key: 'ArrowUp' });
    expect(dark).toHaveFocus();
    expect(dark).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(dark, { key: 'ArrowDown' });
    expect(system).toHaveFocus();
  });
});
