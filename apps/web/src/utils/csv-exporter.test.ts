import { describe, expect, it } from 'vitest';
import { generateMasterReportCSV } from './csv-exporter';
import { getMasterAttendanceReport } from '@/supabase/data/reports';
import { getAllEvents } from '@/supabase/data/events';

describe('csv-exporter utility', () => {
  it('generates well-formatted CSV with metadata headers and student roster', () => {
    const event = getAllEvents()[0];
    const report = getMasterAttendanceReport(event.id);
    const csv = generateMasterReportCSV(report);

    expect(csv).toContain('HOLY NAME UNIVERSITY - MASTER ATTENDANCE REPORT');
    expect(csv).toContain(event.title);
    expect(csv).toContain('Student ID,Last Name,First Name');
    expect(csv).toContain(report.roster[0].student.student_id);
    expect(csv).toContain(report.roster[0].student.last_name);
  });
});
