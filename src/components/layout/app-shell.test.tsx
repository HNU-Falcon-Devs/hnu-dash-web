import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Providers } from '@/components/providers';
import { AppShell } from './app-shell';

describe('mobile navigation drawer', () => {
  it('focuses the drawer, closes with Escape, and restores focus to the opener', () => {
    render(<Providers><AppShell /></Providers>);
    const opener = screen.getByRole('button', { name: 'Open navigation menu' });
    opener.focus();
    fireEvent.click(opener);

    const drawer = screen.getByRole('dialog', { name: 'Mobile navigation' });
    expect(opener).toHaveAttribute('aria-expanded', 'true');
    expect(within(drawer).getByRole('button', { name: 'Close navigation menu' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    expect(opener).toHaveFocus();
  });

  it('contains focus while open and restores it after closing with the drawer button', () => {
    render(<Providers><AppShell /></Providers>);
    const opener = screen.getByRole('button', { name: 'Open navigation menu' });
    opener.focus();
    fireEvent.click(opener);

    const drawer = screen.getByRole('dialog', { name: 'Mobile navigation' });
    const close = within(drawer).getByRole('button', { name: 'Close navigation menu' });
    const last = within(drawer).getByRole('link', { name: 'Attendance' });

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();

    opener.focus();
    expect(close).toHaveFocus();

    fireEvent.click(close);
    expect(opener).toHaveFocus();
  });
});
