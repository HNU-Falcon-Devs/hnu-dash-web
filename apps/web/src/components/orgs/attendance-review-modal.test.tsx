import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceReviewModal } from './attendance-review-modal';
import { MOCK_EVENTS } from '@/lib/mock-data';

describe('AttendanceReviewModal component', () => {
  const sampleEvent = MOCK_EVENTS[0];

  it('renders attendance log audit records and metrics', () => {
    render(
      <AttendanceReviewModal
        isOpen={true}
        onClose={vi.fn()}
        event={sampleEvent}
      />
    );

    expect(
      screen.getByText('Attendance Record Audit & Review')
    ).toBeInTheDocument();
    expect(screen.getByText('Total Scans')).toBeInTheDocument();
    expect(screen.getAllByText('Present').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Late').length).toBeGreaterThanOrEqual(1);
  });

  it('allows org admins to override attendance status to Excused', () => {
    render(
      <AttendanceReviewModal
        isOpen={true}
        onClose={vi.fn()}
        event={sampleEvent}
      />
    );

    const excuseButtons = screen.getAllByRole('button', {
      name: /Mark Excused/i,
    });
    expect(excuseButtons.length).toBeGreaterThan(0);

    fireEvent.click(excuseButtons[0]);

    // Should now show additional excused entry
    expect(screen.getAllByText('Excused').length).toBeGreaterThanOrEqual(1);
  });
});
