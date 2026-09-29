/**
 * Utility to convert master attendance report data to compliant CSV format
 * and trigger client-side download.
 */

import type { MasterAttendanceReport } from '@/lib/definitions';
import { formatDateTime } from './formatters';

export function generateMasterReportCSV(report: MasterAttendanceReport): string {
  const headers = [
    'Student ID',
    'Last Name',
    'First Name',
    'Degree Program',
    'Year Level',
    'Overall Attendance',
    'Time-In Status',
    'Time-In Timestamp',
    'Time-Out Status',
    'Time-Out Timestamp',
    'Penalty Fine (PHP)',
  ];

  const rows = report.roster.map((item) => {
    const student = item.student;
    const timeInStatus = item.time_in ? item.time_in.status : 'None';
    const timeInAt = item.time_in ? formatDateTime(item.time_in.scanned_at) : 'N/A';
    const timeOutStatus = item.time_out ? item.time_out.status : 'None';
    const timeOutAt = item.time_out ? formatDateTime(item.time_out.scanned_at) : 'N/A';

    return [
      `"${student.student_id}"`,
      `"${student.last_name}"`,
      `"${student.first_name}"`,
      `"${student.course}"`,
      `"${student.year_level}"`,
      `"${item.overall_status.toUpperCase()}"`,
      `"${timeInStatus}"`,
      `"${timeInAt}"`,
      `"${timeOutStatus}"`,
      `"${timeOutAt}"`,
      item.fine_amount.toFixed(2),
    ].join(',');
  });

  const metadataHeader = [
    `"HOLY NAME UNIVERSITY - MASTER ATTENDANCE REPORT"`,
    `"Event Title: ${report.event.title.replace(/"/g, '""')}"`,
    `"Organization: ${report.event.organization.name} (${report.event.organization.code})"`,
    `"Date Generated: ${new Date().toISOString()}"`,
    `"Total Enrolled: ${report.total_enrolled}"`,
    `"Total Present: ${report.total_present}"`,
    `"Total Late: ${report.total_late}"`,
    `"Total Excused: ${report.total_excused}"`,
    `"Total Absent: ${report.total_absent}"`,
    `"Attendance Compliance Rate: ${report.attendance_rate_percentage}%"`,
    `"Total Penalty Fines: PHP ${report.total_fines_generated.toFixed(2)}"`,
    '',
  ].join('\n');

  return `${metadataHeader}\n${headers.join(',')}\n${rows.join('\n')}`;
}

export function downloadCSV(filename: string, csvContent: string): boolean {
  if (typeof window === 'undefined' || !window.Blob || !window.URL) {
    return false;
  }

  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
