import { describe, expect, it } from 'vitest';
import { civilDayKey, isValidTimeZone, parseBedtimeOffsetMinutes, parseCivilDayKey, toCivilDate } from '@/lib/timezone';

describe('isValidTimeZone', () => {
  it('accepts real IANA time zones', () => {
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
  });

  it('rejects missing or bogus values', () => {
    expect(isValidTimeZone(undefined)).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
  });
});

describe('parseBedtimeOffsetMinutes', () => {
  it('converts HH:MM into minutes after midnight', () => {
    expect(parseBedtimeOffsetMinutes('00:00')).toBe(0);
    expect(parseBedtimeOffsetMinutes('01:30')).toBe(90);
    expect(parseBedtimeOffsetMinutes('23:59')).toBe(1439);
  });

  it('defaults to 0 when unset', () => {
    expect(parseBedtimeOffsetMinutes(undefined)).toBe(0);
    expect(parseBedtimeOffsetMinutes(null)).toBe(0);
    expect(parseBedtimeOffsetMinutes('')).toBe(0);
  });
});

describe('toCivilDate', () => {
  it('buckets an instant into the calendar day it falls on, in UTC, with no bedtime offset', () => {
    const civil = toCivilDate('2024-03-10T15:00:00Z', 'UTC', 0);
    expect(civilDayKey(civil)).toBe('2024-03-10');
  });

  it('converts to the viewer\'s time zone before bucketing (standard time, UTC-5)', () => {
    // 04:30 UTC on the 15th is 23:30 on the 14th in New York (EST, no DST in January)
    const civil = toCivilDate('2024-01-15T04:30:00Z', 'America/New_York', 0);
    expect(civilDayKey(civil)).toBe('2024-01-14');
  });

  it('converts to the viewer\'s time zone before bucketing (daylight time, UTC-4)', () => {
    // 03:30 UTC on the 15th is 23:30 on the 14th in New York (EDT, daylight saving in July)
    const civil = toCivilDate('2024-07-15T03:30:00Z', 'America/New_York', 0);
    expect(civilDayKey(civil)).toBe('2024-07-14');
  });

  it('counts a log before bedtime toward the previous day', () => {
    const bedtimeOffsetMinutes = parseBedtimeOffsetMinutes('01:30');
    // 01:00 local, 30 minutes before the 01:30 cutoff, should still belong to the 9th
    const beforeBedtime = toCivilDate('2024-03-10T01:00:00Z', 'UTC', bedtimeOffsetMinutes);
    expect(civilDayKey(beforeBedtime)).toBe('2024-03-09');
  });

  it('counts a log after bedtime toward the current day', () => {
    const bedtimeOffsetMinutes = parseBedtimeOffsetMinutes('01:30');
    // 02:00 local, after the 01:30 cutoff, belongs to the 10th
    const afterBedtime = toCivilDate('2024-03-10T02:00:00Z', 'UTC', bedtimeOffsetMinutes);
    expect(civilDayKey(afterBedtime)).toBe('2024-03-10');
  });
});

describe('parseCivilDayKey', () => {
  it('parses a day key back into its civil date', () => {
    expect(civilDayKey(parseCivilDayKey('2024-03-10')!)).toBe('2024-03-10');
  });

  it('rejects malformed or impossible dates', () => {
    expect(parseCivilDayKey(undefined)).toBeNull();
    expect(parseCivilDayKey('2024-3-10')).toBeNull();
    expect(parseCivilDayKey('2024-02-30')).toBeNull();
    expect(parseCivilDayKey('yesterday')).toBeNull();
  });
});
