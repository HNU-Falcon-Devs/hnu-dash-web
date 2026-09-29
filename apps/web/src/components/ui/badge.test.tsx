import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AttendanceStatusBadge, Badge, TenantRoleBadge } from './badge';

describe('Badge components', () => {
  it('renders general Badge with text', () => {
    render(<Badge>Sample Badge</Badge>);
    expect(screen.getByText('Sample Badge')).toBeInTheDocument();
  });

  it('renders TenantRoleBadge with proper role label', () => {
    const { rerender } = render(<TenantRoleBadge role="admin" />);
    expect(screen.getByText('Admin')).toBeInTheDocument();

    rerender(<TenantRoleBadge role="officer" />);
    expect(screen.getByText('Officer')).toBeInTheDocument();

    rerender(<TenantRoleBadge role="student" />);
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('renders AttendanceStatusBadge with correct status label', () => {
    const { rerender } = render(<AttendanceStatusBadge status="present" />);
    expect(screen.getByText('Present')).toBeInTheDocument();

    rerender(<AttendanceStatusBadge status="late" />);
    expect(screen.getByText('Late')).toBeInTheDocument();

    rerender(<AttendanceStatusBadge status="excused" />);
    expect(screen.getByText('Excused')).toBeInTheDocument();
  });
});
