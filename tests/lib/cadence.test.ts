import { describe, expect, it } from 'vitest';
import { agendaStatus, cadenceFromSuggestion, cadenceProgress, cadenceStatus, describeCadence, isHabitComplete, parseCadence, startOfWeek, upcomingDays, withTimes, type Cadence } from '@/lib/cadence';
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

  it('completes a several-times-a-week habit once it has that many entries this week', () => {
    const thriceWeekly: Cadence = { type: 'calendarWeek', times: 3 };
    // Sunday and Tuesday this week, and the Saturday before, which is last week
    const logs = [at('2026-09-27T09:00:00Z'), at('2026-09-29T09:00:00Z'), at('2026-09-26T09:00:00Z')];
    expect(complete(thriceWeekly, logs)).toBe(false);
    expect(cadenceProgress(thriceWeekly, logs, user, now)).toEqual({ done: 2, needed: 3, period: 'weekly' });
    expect(complete(thriceWeekly, [...logs, at('2026-10-03T08:00:00Z')])).toBe(true);
  });

  it('completes a several-times-a-month habit once it has that many entries this month', () => {
    const twiceMonthly: Cadence = { type: 'calendarMonth', times: 2 };
    expect(cadenceProgress(twiceMonthly, [at('2026-10-01T09:00:00Z'), at('2026-09-30T09:00:00Z')], user, now)).toEqual({ done: 1, needed: 2, period: 'monthly' });
    expect(complete(twiceMonthly, [at('2026-10-01T09:00:00Z'), at('2026-10-02T09:00:00Z')])).toBe(true);
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

describe('cadenceStatus', () => {
  const status = (cadence: Cadence, logs: Date[]) => cadenceStatus(cadence, logs, user, now);
  const everyFourteenDays: Cadence = { type: 'everyNDays', days: 14 };

  it('is due on and after the due date', () => {
    // Done 14 days ago: covered through yesterday, due today
    expect(status(everyFourteenDays, [at('2026-09-19T09:00:00Z')])).toEqual({ state: 'due' });
    expect(status(everyFourteenDays, [at('2026-09-01T09:00:00Z')])).toEqual({ state: 'due' });
    expect(status(everyFourteenDays, [])).toEqual({ state: 'due' });
  });

  it('is upcoming in the last 20% of an every-N-days stretch, rounded up to whole days', () => {
    // 14 days: upcoming for the last 3 (2.8 rounded up)
    expect(status(everyFourteenDays, [at('2026-09-22T09:00:00Z')])).toEqual({ state: 'upcoming', dueInDays: 3 });
    expect(status(everyFourteenDays, [at('2026-09-20T09:00:00Z')])).toEqual({ state: 'upcoming', dueInDays: 1 });
    expect(status(everyFourteenDays, [at('2026-09-23T09:00:00Z')])).toEqual({ state: 'done' });
  });

  it('counts from the latest entry', () => {
    expect(status(everyFourteenDays, [at('2026-09-20T09:00:00Z'), at('2026-10-01T09:00:00Z')])).toEqual({ state: 'done' });
  });

  it('is never upcoming for every 3 days or fewer, or for other cadences', () => {
    expect(status({ type: 'everyNDays', days: 3 }, [at('2026-10-01T09:00:00Z')])).toEqual({ state: 'done' });
    expect(status({ type: 'daily', timesPerDay: 1 }, [at('2026-10-03T09:00:00Z')])).toEqual({ state: 'done' });
    // Done this week, and the week ends tomorrow
    expect(status({ type: 'calendarWeek' }, [at('2026-09-28T09:00:00Z')])).toEqual({ state: 'done' });
  });
});

describe('agendaStatus', () => {
  const status = (cadence: Cadence, logs: Date[], when = now, who = user) => agendaStatus(cadence, logs, who, when);
  const weekly: Cadence = { type: 'calendarWeek' };
  const monthly: Cadence = { type: 'calendarMonth' };

  it('is due for a weekly habit not done yet only on the last day of the week', () => {
    // Saturday is the last day of a Sunday-start week
    expect(status(weekly, [])).toEqual({ state: 'due' });
    // Wednesday: due Saturday
    expect(status(weekly, [], at('2026-09-30T15:00:00Z'))).toEqual({ state: 'upcoming', dueInDays: 3 });
    // In a Monday-start week, Saturday has a day to spare
    expect(status(weekly, [], now, { ...user, weekStartsOn: 'monday' })).toEqual({ state: 'upcoming', dueInDays: 1 });
  });

  it('is due for a monthly habit not done yet only on the last day of the month', () => {
    expect(status(monthly, [])).toEqual({ state: 'upcoming', dueInDays: 28 });
    expect(status(monthly, [], at('2026-10-31T15:00:00Z'))).toEqual({ state: 'due' });
    // Last month's entry doesn't help
    expect(status(monthly, [at('2026-09-30T09:00:00Z')], at('2026-10-30T15:00:00Z'))).toEqual({ state: 'upcoming', dueInDays: 1 });
  });

  it('is due for a several-times-a-week habit only on the last day, however many entries it still needs', () => {
    const thriceWeekly: Cadence = { type: 'calendarWeek', times: 3 };
    // Thursday, with none done: two days to spare, since all three can be logged Saturday
    expect(status(thriceWeekly, [], at('2026-10-01T15:00:00Z'))).toEqual({ state: 'upcoming', dueInDays: 2 });
    expect(status(thriceWeekly, [at('2026-09-28T09:00:00Z')])).toEqual({ state: 'due' });
  });

  it('is done once a weekly or monthly habit is met, and leaves other cadences as cadenceStatus has them', () => {
    expect(status(weekly, [at('2026-09-28T09:00:00Z')], at('2026-09-30T15:00:00Z'))).toEqual({ state: 'done' });
    expect(status({ type: 'daily', timesPerDay: 1 }, [])).toEqual({ state: 'due' });
    expect(status({ type: 'everyNDays', days: 14 }, [at('2026-09-22T09:00:00Z')])).toEqual({ state: 'upcoming', dueInDays: 3 });
  });
});

describe('upcomingDays', () => {
  it('is a fifth of the stretch, rounded up, without floating point surprises', () => {
    expect(upcomingDays({ type: 'everyNDays', days: 4 })).toBe(1);
    expect(upcomingDays({ type: 'everyNDays', days: 10 })).toBe(2);
    // 15 * 0.2 is 3.0000000000000004 in floating point, which would round up to 4
    expect(upcomingDays({ type: 'everyNDays', days: 15 })).toBe(3);
    expect(upcomingDays({ type: 'everyNDays', days: 30 })).toBe(6);
    expect(upcomingDays({ type: 'everyNDays', days: 3 })).toBe(0);
    expect(upcomingDays({ type: 'calendarMonth' })).toBe(0);
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

  it('uses the given fallback instead, e.g. none for a category', () => {
    expect(parseCadence(undefined, { type: 'none' })).toEqual({ type: 'none' });
  });
});

describe('cadenceFromSuggestion', () => {
  it('fills in missing numbers with defaults', () => {
    expect(cadenceFromSuggestion({ type: 'daily' })).toEqual({ type: 'daily', timesPerDay: 1 });
    expect(cadenceFromSuggestion({ type: 'everyNDays' })).toEqual({ type: 'everyNDays', days: 2 });
    expect(cadenceFromSuggestion({ type: 'calendarMonth', days: 5 })).toEqual({ type: 'calendarMonth' });
    expect(cadenceFromSuggestion({ type: 'calendarWeek', timesPerPeriod: 3 })).toEqual({ type: 'calendarWeek', times: 3 });
    expect(cadenceFromSuggestion({ type: 'calendarWeek', timesPerPeriod: 1 })).toEqual({ type: 'calendarWeek' });
  });

  it('means no cadence for no suggestion or one that doesn\'t fit', () => {
    expect(cadenceFromSuggestion(undefined)).toEqual({ type: 'none' });
    expect(cadenceFromSuggestion({ type: 'everyNDays', days: 1 })).toEqual({ type: 'none' });
  });
});

describe('describeCadence', () => {
  it('describes each cadence for people', () => {
    expect(describeCadence({ type: 'daily', timesPerDay: 1 })).toBe('Daily');
    expect(describeCadence({ type: 'daily', timesPerDay: 3 })).toBe('3× daily');
    expect(describeCadence({ type: 'everyNDays', days: 3 })).toBe('Every 3 days');
    expect(describeCadence({ type: 'calendarWeek' })).toBe('Weekly');
    expect(describeCadence({ type: 'calendarMonth' })).toBe('Monthly');
    expect(describeCadence({ type: 'calendarWeek', times: 3 })).toBe('3× weekly');
    expect(describeCadence({ type: 'calendarMonth', times: 2 })).toBe('2× monthly');
    expect(describeCadence({ type: 'none' })).toBe('No set cadence');
  });
});

describe('withTimes', () => {
  it('stores once a week or month the way it always was, with no count', () => {
    expect(withTimes({ type: 'calendarWeek', times: 3 }, 1)).toEqual({ type: 'calendarWeek' });
    expect(withTimes({ type: 'calendarMonth' }, 4)).toEqual({ type: 'calendarMonth', times: 4 });
    expect(parseCadence('{"type":"calendarWeek"}')).toEqual({ type: 'calendarWeek' });
  });
});
