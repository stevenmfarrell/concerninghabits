import { describe, expect, it } from 'vitest';
import { cadenceFromSuggestion, describeCadence, isHabitComplete, parseCadence, startOfWeek, type Cadence } from '@/lib/cadence';
import { civilDayKey, parseCivilDayKey } from '@/lib/timezone';

const user = { timeZone: 'UTC', bedtime: '00:00', weekStartsOn: 'sunday' };
// Saturday, October 3rd 2026, mid-afternoon
const now = new Date('2026-10-03T15:00:00Z');
const at = (iso: string) => new Date(iso);
const complete = (cadence: Cadence, logs: Date[], who = user, when = now) => isHabitComplete(cadence, logs, who, when);

describe('startOfWeek', () => {
  it('goes back to the Sunday or Monday the week starts on', () => {
    const saturday = parseCivilDayKey('2026-10-03')!;
    expect(civilDayKey(startOfWeek(saturday, 'sunday'))).toBe('2026-09-27');
    expect(civilDayKey(startOfWeek(saturday, 'monday'))).toBe('2026-09-28');
  });

  it('treats a Sunday as the end of a Monday-start week', () => {
    const sunday = parseCivilDayKey('2026-10-04')!;
    expect(civilDayKey(startOfWeek(sunday, 'sunday'))).toBe('2026-10-04');
    expect(civilDayKey(startOfWeek(sunday, 'monday'))).toBe('2026-09-28');
  });
});

describe('isHabitComplete', () => {
  it('completes a daily habit with an entry today, not yesterday', () => {
    const daily: Cadence = { type: 'daily', timesPerDay: 1 };
    expect(complete(daily, [at('2026-10-03T08:00:00Z')])).toBe(true);
    expect(complete(daily, [at('2026-10-02T20:00:00Z')])).toBe(false);
    expect(complete(daily, [])).toBe(false);
  });

  it('completes a several-times-a-day habit once it reaches its count today', () => {
    const water: Cadence = { type: 'daily', timesPerDay: 3 };
    const twice = [at('2026-10-03T08:00:00Z'), at('2026-10-03T10:00:00Z')];
    expect(complete(water, twice)).toBe(false);
    expect(complete(water, [...twice, at('2026-10-03T12:00:00Z')])).toBe(true);
    // Yesterday's entries don't count toward today
    expect(complete(water, [...twice, at('2026-10-02T12:00:00Z')])).toBe(false);
  });

  it('counts an every-N-days entry for its own day and the days after it, until the next is due', () => {
    const everyTwoDays: Cadence = { type: 'everyNDays', days: 2 };
    // Not done for a week, then done today: done today and tomorrow, due again the day after
    const doneToday = [at('2026-09-26T09:00:00Z'), at('2026-10-03T09:00:00Z')];
    expect(complete(everyTwoDays, doneToday)).toBe(true);
    expect(complete(everyTwoDays, doneToday, user, at('2026-10-04T15:00:00Z'))).toBe(true);
    expect(complete(everyTwoDays, doneToday, user, at('2026-10-05T15:00:00Z'))).toBe(false);
    // Done yesterday still counts today; done two days ago doesn't
    expect(complete(everyTwoDays, [at('2026-10-02T09:00:00Z')])).toBe(true);
    expect(complete(everyTwoDays, [at('2026-10-01T09:00:00Z')])).toBe(false);
  });

  it('completes a calendar-week habit with an entry any day this week, by the user\'s week start', () => {
    const weekly: Cadence = { type: 'calendarWeek' };
    const lastSunday = [at('2026-09-27T12:00:00Z')];
    expect(complete(weekly, lastSunday)).toBe(true);
    // In a Monday-start week, that Sunday belongs to the previous week
    expect(complete(weekly, lastSunday, { ...user, weekStartsOn: 'monday' })).toBe(false);
  });

  it('completes a calendar-month habit with an entry any day this month', () => {
    const monthly: Cadence = { type: 'calendarMonth' };
    expect(complete(monthly, [at('2026-10-01T09:00:00Z')])).toBe(true);
    expect(complete(monthly, [at('2026-09-30T09:00:00Z')])).toBe(false);
  });

  it('never completes a habit with no cadence', () => {
    expect(complete({ type: 'none' }, [at('2026-10-03T08:00:00Z'), at('2026-10-03T09:00:00Z')])).toBe(false);
  });

  it('counts an entry before bedtime toward the previous day', () => {
    const daily: Cadence = { type: 'daily', timesPerDay: 1 };
    const lateNight = { ...user, bedtime: '02:00' };
    // 1am Saturday is still Friday for someone who goes to bed at 2am
    expect(complete(daily, [at('2026-10-03T01:00:00Z')], lateNight)).toBe(false);
    expect(complete(daily, [at('2026-10-03T03:00:00Z')], lateNight)).toBe(true);
  });

  it('follows the user\'s time zone for where a day starts', () => {
    // 3am UTC Saturday is still Friday evening in New York
    expect(complete({ type: 'daily', timesPerDay: 1 }, [at('2026-10-03T03:00:00Z')], { ...user, timeZone: 'America/New_York' })).toBe(false);
  });
});

describe('parseCadence', () => {
  it('reads a stored cadence', () => {
    expect(parseCadence('{"type":"everyNDays","days":3}')).toEqual({ type: 'everyNDays', days: 3 });
    expect(parseCadence('{"type":"none"}')).toEqual({ type: 'none' });
  });

  it('falls back to daily for anything missing, malformed, or unknown', () => {
    const daily = { type: 'daily', timesPerDay: 1 };
    expect(parseCadence(null)).toEqual(daily);
    expect(parseCadence('not json')).toEqual(daily);
    expect(parseCadence('{"type":"fortnightly"}')).toEqual(daily);
    expect(parseCadence('{"type":"everyNDays","days":0}')).toEqual(daily);
  });
});

describe('cadenceFromSuggestion', () => {
  it('fills in missing numbers with defaults', () => {
    expect(cadenceFromSuggestion({ type: 'daily' })).toEqual({ type: 'daily', timesPerDay: 1 });
    expect(cadenceFromSuggestion({ type: 'everyNDays' })).toEqual({ type: 'everyNDays', days: 2 });
    expect(cadenceFromSuggestion({ type: 'calendarMonth', days: 5 })).toEqual({ type: 'calendarMonth' });
  });

  it('falls back to daily for no suggestion or one that doesn\'t fit', () => {
    expect(cadenceFromSuggestion(undefined)).toEqual({ type: 'daily', timesPerDay: 1 });
    expect(cadenceFromSuggestion({ type: 'everyNDays', days: 1 })).toEqual({ type: 'daily', timesPerDay: 1 });
  });
});

describe('describeCadence', () => {
  it('describes each cadence for people', () => {
    expect(describeCadence({ type: 'daily', timesPerDay: 1 })).toBe('Daily');
    expect(describeCadence({ type: 'daily', timesPerDay: 3 })).toBe('3× a day');
    expect(describeCadence({ type: 'everyNDays', days: 3 })).toBe('Every 3 days');
    expect(describeCadence({ type: 'calendarWeek' })).toBe('Once a week');
    expect(describeCadence({ type: 'none' })).toBe('No set cadence');
  });
});
