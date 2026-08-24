import { describe, expect, it } from 'vitest';
import { businessDateParts, businessOffsetMinutes, businessTimeToUtc, toIsoDate } from '@/lib/tz';

/**
 * Every reservation slot is a wall-clock time in Tunisia stored as a UTC
 * instant. Getting this wrong sends customers to the salon an hour early, and
 * the bug is invisible on a machine whose own clock happens to be in Tunis.
 */
describe('business timezone', () => {
  it('reports the Africa/Tunis offset', () => {
    // Tunisia has been on UTC+1 year-round since 2008.
    expect(businessOffsetMinutes(new Date('2026-01-15T12:00:00Z'))).toBe(60);
    expect(businessOffsetMinutes(new Date('2026-07-15T12:00:00Z'))).toBe(60);
  });

  it('converts a local wall-clock time to the right instant', () => {
    // 09:00 in Tunis is 08:00 UTC.
    const instant = businessTimeToUtc(2026, 9, 15, 9 * 60);
    expect(instant.toISOString()).toBe('2026-09-15T08:00:00.000Z');
  });

  it('round-trips a date through local parts', () => {
    const instant = businessTimeToUtc(2026, 3, 1, 23 * 60 + 30);
    const parts = businessDateParts(instant);
    expect(toIsoDate(parts)).toBe('2026-03-01');
    expect(parts.weekday).toBe(0); // 1 March 2026 is a Sunday
  });

  it('keeps a late-evening slot on the same local day', () => {
    // 23:30 local is 22:30 UTC — the same calendar day in both, but the naive
    // implementation that subtracts an hour from midnight lands on the 28th.
    const instant = businessTimeToUtc(2026, 2, 28, 23 * 60 + 30);
    expect(toIsoDate(businessDateParts(instant))).toBe('2026-02-28');
  });
});
