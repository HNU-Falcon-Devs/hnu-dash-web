import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StudentAttendanceTable } from './student-attendance-table';
import { getStudentAttendanceRecords } from '@/supabase/data/student-portal';
import { MOCK_PROFILES } from '@/lib/mock-data';

describe('StudentAttendanceTable component', () => {
  const records = getStudentAttendanceRecords(MOCK_PROFILES.maria.id);

  it('renders attendance history records and organization codes', () => {
    render(<StudentAttendanceTable records={records} />);

    expect(
      screen.getByText('Attendance Records & Fine Ledger')
    ).toBeInTheDocument();
    expect(screen.getAllByText('CCS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SYCOMP').length).toBeGreaterThan(0);
  });

  it('filters records by organization selection', () => {
    render(<StudentAttendanceTable records={records} />);

    const selects = screen.getAllByRole('combobox');
    const orgSelect = selects[0];

    // Filter to CCS only
    fireEvent.change(orgSelect, { target: { value: 'org-ccs-001' } });

    expect(screen.getAllByText('CCS').length).toBeGreaterThan(0);
  });

  it('opens receipt detail audit modal on receipt button click', () => {
    render(<StudentAttendanceTable records={records} />);

    const receiptButtons = screen.getAllByRole('button', {
      name: /Receipt/i,
    });
    expect(receiptButtons.length).toBeGreaterThan(0);

    fireEvent.click(receiptButtons[0]);

    expect(
      screen.getByText('Attendance Log Verification Receipt')
    ).toBeInTheDocument();
  });
});
