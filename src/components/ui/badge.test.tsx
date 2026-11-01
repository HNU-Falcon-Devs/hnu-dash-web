import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders presentational content with optional status decoration', () => {
    render(<Badge variant="primary" dot>Foundation</Badge>);
    const badge = screen.getByText('Foundation');
    expect(badge).toBeInTheDocument();
    expect(badge.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
