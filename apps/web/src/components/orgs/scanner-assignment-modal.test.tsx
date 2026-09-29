import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScannerAssignmentModal } from './scanner-assignment-modal';
import { MOCK_EVENTS } from '@/lib/mock-data';

describe('ScannerAssignmentModal component', () => {
  const sampleEvent = MOCK_EVENTS[0]; // CCS General Assembly

  it('renders eligible officers and assignment policy notice', () => {
    render(
      <ScannerAssignmentModal
        isOpen={true}
        onClose={vi.fn()}
        event={sampleEvent}
      />
    );

    expect(screen.getByText('Officer Scanner Delegation')).toBeInTheDocument();
    expect(
      screen.getByText(/Strict Scanner Delegation Policy/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Christian Vargas')).toBeInTheDocument();
  });

  it('allows delegating scanner duty when clicking Assign Scanner', () => {
    const handleAssignmentChange = vi.fn();

    render(
      <ScannerAssignmentModal
        isOpen={true}
        onClose={vi.fn()}
        event={sampleEvent}
        onAssignmentChange={handleAssignmentChange}
      />
    );

    // Find Christian Vargas's assign button
    const assignButtons = screen.getAllByRole('button', {
      name: /Assign Scanner/i,
    });
    expect(assignButtons.length).toBeGreaterThan(0);

    fireEvent.click(assignButtons[0]);
    expect(handleAssignmentChange).toHaveBeenCalled();
  });
});
