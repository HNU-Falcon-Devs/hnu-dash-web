import { describe, expect, it } from 'vitest';
import {
  formatCurrencyPHP,
  formatDate,
  formatDateTime,
  formatFullName,
  formatTargetYearLevels,
  formatTime,
  formatTimeRange,
  formatYearLevel,
} from './formatters';

describe('formatCurrencyPHP', () => {
  it('formats positive numbers as PHP currency', () => {
    const formatted = formatCurrencyPHP(50);
    expect(formatted).toContain('50.00');
  });

  it('formats zero correctly', () => {
    const formatted = formatCurrencyPHP(0);
    expect(formatted).toContain('0.00');
  });

  it('handles decimal precision', () => {
    const formatted = formatCurrencyPHP(125.5);
    expect(formatted).toContain('125.50');
  });

  it('handles invalid numbers by falling back to zero', () => {
    const formatted = formatCurrencyPHP(NaN);
    expect(formatted).toContain('0.00');
  });
});

describe('formatDate and formatTime', () => {
  const sampleIso = '2026-09-29T08:30:00.000Z';

  it('formats date to short month string', () => {
    const result = formatDate(sampleIso);
    expect(result).toMatch(/Sep \d+, 2026/);
  });

  it('formats time with AM/PM', () => {
    const result = formatTime(sampleIso);
    expect(result).toMatch(/(AM|PM)/);
  });

  it('formats combined date and time', () => {
    const result = formatDateTime(sampleIso);
    expect(result).toContain('2026');
    expect(result).toMatch(/(AM|PM)/);
  });

  it('handles invalid date input gracefully', () => {
    expect(formatDate('invalid')).toBe('Invalid Date');
    expect(formatTime('invalid')).toBe('Invalid Time');
    expect(formatDateTime('invalid')).toBe('Invalid Date');
  });
});

describe('formatTimeRange', () => {
  it('formats a valid time window range', () => {
    const start = '2026-09-29T08:00:00.000Z';
    const end = '2026-09-29T09:30:00.000Z';
    const range = formatTimeRange(start, end);
    expect(range).toContain('–');
  });

  it('returns fallback for invalid inputs', () => {
    expect(formatTimeRange('invalid', 'invalid')).toBe('Invalid Time Range');
  });
});

describe('formatYearLevel', () => {
  it('formats standard academic year levels', () => {
    expect(formatYearLevel(1)).toBe('1st Year');
    expect(formatYearLevel(2)).toBe('2nd Year');
    expect(formatYearLevel(3)).toBe('3rd Year');
    expect(formatYearLevel(4)).toBe('4th Year');
    expect(formatYearLevel(5)).toBe('5th Year');
    expect(formatYearLevel(6)).toBe('Year 6');
  });
});

describe('formatTargetYearLevels', () => {
  it('returns "All Year Levels" for null, empty, or all 5 years', () => {
    expect(formatTargetYearLevels(null)).toBe('All Year Levels');
    expect(formatTargetYearLevels([])).toBe('All Year Levels');
    expect(formatTargetYearLevels([1, 2, 3, 4, 5])).toBe('All Year Levels');
  });

  it('formats single year level', () => {
    expect(formatTargetYearLevels([3])).toBe('3rd Year Only');
  });

  it('formats two year levels', () => {
    expect(formatTargetYearLevels([1, 2])).toBe('1st & 2nd Year');
  });

  it('formats three or more year levels', () => {
    expect(formatTargetYearLevels([1, 2, 4])).toBe('1st, 2nd & 4th Year');
  });
});

describe('formatFullName', () => {
  it('combines first and last name with trimmed whitespace', () => {
    expect(formatFullName(' Juan ', ' Dela Cruz ')).toBe('Juan Dela Cruz');
  });
});
