import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StudentClearanceSummary } from './student-clearance-summary';
import type { StudentClearanceStatus } from '@/lib/definitions';
import { MOCK_PROFILES } from '@/lib/mock-data';

describe('StudentClearanceSummary component', () => {
  const sampleClearedStatus: StudentClearanceStatus = {
    student: MOCK_PROFILES.juan,
    overall_status: 'cleared',
    total_fines: 0,
    organization_breakdowns: [
      {
        organization: { id: 'org-1', name: 'CCS Council', code: 'CCS' },
        total_events: 1,
        attended_events: 1,
        missed_events: 0,
        total_fines: 0,
        status: 'cleared',
      },
    ],
  };

  const sampleHoldStatus: StudentClearanceStatus = {
    student: MOCK_PROFILES.maria,
    overall_status: 'action_required',
    total_fines: 60,
    organization_breakdowns: [
      {
        organization: { id: 'org-1', name: 'CCS Council', code: 'CCS' },
        total_events: 1,
        attended_events: 1,
        missed_events: 0,
        total_fines: 0,
        status: 'cleared',
      },
      {
        organization: { id: 'org-2', name: 'SYCOMP', code: 'SYCOMP' },
        total_events: 1,
        attended_events: 0,
        missed_events: 1,
        total_fines: 60,
        status: 'pending_fines',
      },
    ],
  };

  it('renders CLEARED status when no fines are outstanding', () => {
    render(<StudentClearanceSummary clearance={sampleClearedStatus} />);
    expect(screen.getAllByText('CLEARED').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText('Eligible for Semester Sign-off')
    ).toBeInTheDocument();
  });

  it('renders CLEARANCE HOLD and outstanding fine amount when fines are owed', () => {
    render(<StudentClearanceSummary clearance={sampleHoldStatus} />);
    expect(screen.getByText('CLEARANCE HOLD')).toBeInTheDocument();
    expect(screen.getByText(/Outstanding Fines: ₱60.00/i)).toBeInTheDocument();
  });

  it('opens official printable clearance slip modal on button click', () => {
    render(<StudentClearanceSummary clearance={sampleHoldStatus} />);
    const slipButton = screen.getByRole('button', {
      name: /View Clearance Slip/i,
    });
    fireEvent.click(slipButton);

    expect(
      screen.getByText('Official Student Clearance Slip')
    ).toBeInTheDocument();
    expect(screen.getByText('HOLY NAME UNIVERSITY')).toBeInTheDocument();
    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
  });
});
