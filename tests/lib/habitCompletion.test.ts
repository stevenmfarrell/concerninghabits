import { describe, expect, it } from 'vitest';
import { isHabitComplete, startOfWeek } from '@/lib/habitCompletion';
import { civilDayKey, parseCivilDayKey } from '@/lib/timezone';

const user = { timeZone: 'UTC', bedtime: '00:00', weekStartsOn: 'sunday' };
// Saturday, October 3rd 2026, mid-afternoon
const now = new Date('2026-10-03T15:00:00Z');
const at = (iso: string) => new Date(iso);
const habit = (frequency: string, schema: object = {}) => ({ frequency, schema: JSON.stringify(schema) });

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
    expect(isHabitComplete(habit('daily'), [at('2026-10-03T08:00:00Z')], user, now)).toBe(true);
    expect(isHabitComplete(habit('daily'), [at('2026-10-02T20:00:00Z')], user, now)).toBe(false);
    expect(isHabitComplete(habit('daily'), [], user, now)).toBe(false);
  });

  it('completes a multiple-times-a-day habit once it reaches its target today', () => {
    const waterHabit = habit('multiple', { targetCount: 3 });
    const twice = [at('2026-10-03T08:00:00Z'), at('2026-10-03T10:00:00Z')];
    expect(isHabitComplete(waterHabit, twice, user, now)).toBe(false);
    expect(isHabitComplete(waterHabit, [...twice, at('2026-10-03T12:00:00Z')], user, now)).toBe(true);
    // Yesterday's entries don't count toward today
    expect(isHabitComplete(waterHabit, [...twice, at('2026-10-02T12:00:00Z')], user, now)).toBe(false);
  });

  it('completes a weekly habit with an entry any day this week, by the user\'s week start', () => {
    const lastSunday = [at('2026-09-27T12:00:00Z')];
    expect(isHabitComplete(habit('weekly'), lastSunday, user, now)).toBe(true);
    // In a Monday-start week, that Sunday belongs to the previous week
    expect(isHabitComplete(habit('weekly'), lastSunday, { ...user, weekStartsOn: 'monday' }, now)).toBe(false);
  });

  it('completes a monthly habit with an entry any day this month', () => {
    expect(isHabitComplete(habit('monthly'), [at('2026-10-01T09:00:00Z')], user, now)).toBe(true);
    expect(isHabitComplete(habit('monthly'), [at('2026-09-30T09:00:00Z')], user, now)).toBe(false);
  });

  it('counts an entry before bedtime toward the previous day', () => {
    const lateNight = { ...user, bedtime: '02:00' };
    // 1am Saturday is still Friday for someone who goes to bed at 2am
    expect(isHabitComplete(habit('daily'), [at('2026-10-03T01:00:00Z')], lateNight, now)).toBe(false);
    expect(isHabitComplete(habit('daily'), [at('2026-10-03T03:00:00Z')], lateNight, now)).toBe(true);
  });

  it('follows the user\'s time zone for where a day starts', () => {
    // 3am UTC Saturday is still Friday evening in New York
    expect(isHabitComplete(habit('daily'), [at('2026-10-03T03:00:00Z')], { ...user, timeZone: 'America/New_York' }, now)).toBe(false);
  });
});
