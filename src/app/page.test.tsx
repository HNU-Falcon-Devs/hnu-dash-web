import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Providers } from '@/components/providers';
import Home from './page';

describe('Home page', () => {
  it('renders the branded application shell and neutral foundation content', () => {
    render(<Providers><Home /></Providers>);
    expect(screen.getByRole('heading', { level: 1, name: 'HNU DASH' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'HNU DASH Web' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getByText(/Backend integration is deferred\./)).toBeInTheDocument();
  });
});
