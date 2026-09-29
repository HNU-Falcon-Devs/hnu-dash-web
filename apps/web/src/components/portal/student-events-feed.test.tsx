import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StudentEventsFeed } from './student-events-feed';
import { getAllEvents } from '@/supabase/data/events';

describe('StudentEventsFeed component', () => {
  const events = getAllEvents();

  it('renders upcoming events cards view by default', () => {
    render(<StudentEventsFeed events={events} />);

    expect(
      screen.getByText('Upcoming Events & Attendance Windows')
    ).toBeInTheDocument();
    expect(screen.getAllByText('View Details').length).toBeGreaterThan(0);
  });

  it('switches between cards and table view modes', () => {
    render(<StudentEventsFeed events={events} />);

    const tableButton = screen.getByRole('button', { name: /^Table$/i });
    fireEvent.click(tableButton);

    // In table view, headers should be visible
    expect(screen.getByText('Venue')).toBeInTheDocument();
    expect(screen.getByText('Time-In Window')).toBeInTheDocument();
  });

  it('opens event details modal when clicking View Details', () => {
    render(<StudentEventsFeed events={events} />);

    const detailButtons = screen.getAllByRole('button', {
      name: /View Details/i,
    });
    fireEvent.click(detailButtons[0]);

    expect(
      screen.getByText('Official Student Check-In Windows')
    ).toBeInTheDocument();
  });
});
