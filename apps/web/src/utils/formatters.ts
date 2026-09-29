/**
 * Pure, reusable formatting functions for currency, dates,
 * time-windows, academic years, and user identities.
 */

/**
 * Formats a numeric amount into Philippine Peso (PHP) format.
 * Example: 50 -> "₱50.00", 0 -> "₱0.00"
 */
export function formatCurrencyPHP(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}

/**
 * Formats an ISO date string or Date object into human-readable date.
 * Example: "2026-09-29T08:00:00Z" -> "Sep 29, 2026"
 */
export function formatDate(
  dateInput: string | Date,
  locale: string = 'en-US'
): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Invalid Date';

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Formats an ISO date string or Date object into 12-hour time format with AM/PM.
 * Example: "2026-09-29T08:00:00Z" -> "8:00 AM"
 */
export function formatTime(
  dateInput: string | Date,
  locale: string = 'en-US'
): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Invalid Time';

  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Formats an ISO date string or Date object into combined date and time.
 * Example: "2026-09-29T08:00:00Z" -> "Sep 29, 2026, 8:00 AM"
 */
export function formatDateTime(
  dateInput: string | Date,
  locale: string = 'en-US'
): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return 'Invalid Date';

  return `${formatDate(date, locale)}, ${formatTime(date, locale)}`;
}

/**
 * Formats a time window range between two timestamps.
 * Example: "8:00 AM – 9:30 AM"
 */
export function formatTimeRange(
  startInput: string | Date,
  endInput: string | Date,
  locale: string = 'en-US'
): string {
  const startTime = formatTime(startInput, locale);
  const endTime = formatTime(endInput, locale);

  if (startTime === 'Invalid Time' || endTime === 'Invalid Time') {
    return 'Invalid Time Range';
  }

  return `${startTime} – ${endTime}`;
}

/**
 * Formats a numeric academic year level into ordinal representation.
 * Example: 1 -> "1st Year", 2 -> "2nd Year", 3 -> "3rd Year", 4 -> "4th Year"
 */
export function formatYearLevel(yearLevel: number): string {
  switch (yearLevel) {
    case 1:
      return '1st Year';
    case 2:
      return '2nd Year';
    case 3:
      return '3rd Year';
    case 4:
      return '4th Year';
    case 5:
      return '5th Year';
    default:
      return `Year ${yearLevel}`;
  }
}

/**
 * Formats target year level audience filter into human-readable label.
 * NULL or all 5 years returns "All Year Levels".
 * Example: [1, 2] -> "1st & 2nd Year"
 * Example: [1, 2, 3] -> "1st, 2nd & 3rd Year"
 */
export function formatTargetYearLevels(
  targetYears: number[] | null | undefined
): string {
  if (!targetYears || targetYears.length === 0 || targetYears.length >= 5) {
    return 'All Year Levels';
  }

  const sorted = [...targetYears].sort((a, b) => a - b);
  const labels = sorted.map((y) => formatYearLevel(y).replace(' Year', ''));

  if (labels.length === 1) {
    return `${labels[0]} Year Only`;
  }

  const last = labels.pop();
  return `${labels.join(', ')} & ${last} Year`;
}

/**
 * Combines first and last name into full display name.
 */
export function formatFullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}
