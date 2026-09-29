import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MasterReportModal } from './master-report-modal';
import { getAllEvents } from '@/supabase/data/events';

describe('MasterReportModal component', () => {
  const event = getAllEvents()[0];

  it('renders executive attendance metrics and roster table', () => {
    render(
      <MasterReportModal
        isOpen={true}
        onClose={vi.fn()}
        event={event}
      />
    );

    expect(
      screen.getByText('Master Attendance & Compliance Report')
    ).toBeInTheDocument();
    expect(screen.getByText('Enrolled')).toBeInTheDocument();
    expect(screen.getByText('Turnout')).toBeInTheDocument();
    expect(screen.getByText('Santos, Maria')).toBeInTheDocument();
  });

  it('filters attendees by search query input', () => {
    render(
      <MasterReportModal
        isOpen={true}
        onClose={vi.fn()}
        event={event}
      />
    );

    const searchInput = screen.getByPlaceholderText(
      'Search by student name or ID...'
    );
    fireEvent.change(searchInput, { target: { value: 'Maria' } });

    expect(screen.getByText('Santos, Maria')).toBeInTheDocument();
    expect(screen.queryByText('Vargas, Christian')).not.toBeInTheDocument();
  });

  it('triggers CSV download when clicking Download CSV', () => {
    render(
      <MasterReportModal
        isOpen={true}
        onClose={vi.fn()}
        event={event}
      />
    );

    const downloadButton = screen.getByRole('button', {
      name: /Download CSV/i,
    });
    expect(downloadButton).toBeInTheDocument();
    fireEvent.click(downloadButton);
  });
});
