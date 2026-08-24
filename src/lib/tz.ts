/**
 * BOA operates in Africa/Tunis, which has not observed daylight saving since
 * 2008 — but hard-coding +01:00 would quietly break every future booking if
 * that ever changed, and the bug would only appear on the day of a transition.
 * The offset is therefore computed from the runtime's own timezone database for
 * the instant in question.
 */
export const BUSINESS_TIMEZONE = 'Africa/Tunis';

const OFFSET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/** Minutes that Africa/Tunis is ahead of UTC at the given instant. */
export function businessOffsetMinutes(at: Date): number {
  const parts = OFFSET_FORMATTER.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * Converts a local wall-clock time in Tunisia to the UTC instant it denotes.
 * Two passes: the first guesses the offset from the naive instant, the second
 * corrects it if that guess landed on the wrong side of a transition.
 */
export function businessTimeToUtc(
  year: number,
  month: number,
  day: number,
  minutesFromMidnight: number,
): Date {
  const naive = Date.UTC(year, month - 1, day, 0, minutesFromMidnight);
  const firstGuess = new Date(naive - businessOffsetMinutes(new Date(naive)) * 60000);
  const corrected = new Date(naive - businessOffsetMinutes(firstGuess) * 60000);
  return corrected;
}

/** Y-M-D of an instant, as seen in Tunisia. */
export function businessDateParts(at: Date): { year: number; month: number; day: number; weekday: number } {
  const local = new Date(at.getTime() + businessOffsetMinutes(at) * 60000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    weekday: local.getUTCDay(),
  };
}

export const toIsoDate = (parts: { year: number; month: number; day: number }): string =>
  `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
