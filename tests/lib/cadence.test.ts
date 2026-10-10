import { describe, expect, it } from 'vitest';
import { agendaStatus, cadenceFromSuggestion, cadenceProgress, cadenceSchema, cadenceStatus, daysUntilDue, describeCadence, dueAtStartOfDay, isHabitComplete, parseCadence, skippedCovers, skipState, startOfWeek, upcomingDays, withTimes, type Cadence } from '@/lib/cadence';
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

describe('weekday cadence', () => {
  // Monday, Wednesday and Friday
  const mwf: Cadence = { type: 'weekdays', days: [1, 3, 5] };
  const wednesday = at('2026-09-30T15:00:00Z');
  const thursday = at('2026-10-01T15:00:00Z');
  const status = (logs: Date[], when: Date) => agendaStatus(mwf, logs, user, when);

  it('is due on its days until done that day', () => {
    expect(status([], wednesday)).toEqual({ state: 'due' });
    expect(status([at('2026-09-30T08:00:00Z')], wednesday)).toEqual({ state: 'done' });
    // Monday's entry doesn't count for Wednesday
    expect(status([at('2026-09-28T08:00:00Z')], wednesday)).toEqual({ state: 'due' });
  });

  it('isn\'t due on its other days, only upcoming until the next of its days', () => {
    expect(status([], thursday)).toEqual({ state: 'upcoming', dueInDays: 1 });
    // Saturday: due Monday
    expect(status([], now)).toEqual({ state: 'upcoming', dueInDays: 2 });
    expect(isHabitComplete(mwf, [], user, thursday)).toBe(true);
    expect(daysUntilDue(mwf, [], user, thursday)).toBe(1);
    expect(daysUntilDue(mwf, [], user, wednesday)).toBe(0);
  });

  it('counts an entry on one of its days until the next, so the day off after it is done too', () => {
    expect(status([at('2026-09-30T08:00:00Z')], thursday)).toEqual({ state: 'done' });
    expect(daysUntilDue(mwf, [at('2026-09-30T08:00:00Z')], user, thursday)).toBeNull();
  });

  it('was only due at the start of the day on one of its days', () => {
    expect(dueAtStartOfDay(mwf, [], user, wednesday)).toBe(true);
    expect(dueAtStartOfDay(mwf, [], user, thursday)).toBe(false);
  });

  it('describes its days', () => {
    expect(describeCadence(mwf)).toBe('M,W,F');
    expect(describeCadence({ type: 'weekdays', days: [0, 1, 2, 4, 5] })).toBe('Su,M,Tu,Th,F');
    expect(describeCadence({ type: 'weekdays', days: [1, 2, 3, 4, 5] })).toBe('Weekdays');
    expect(describeCadence({ type: 'weekdays', days: [0, 6] })).toBe('Weekends');
    expect(describeCadence({ type: 'weekdays', days: [2] })).toBe('Every Tuesday');
    expect(describeCadence({ type: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] })).toBe('Every day');
  });

  it('only accepts each day once, in order', () => {
    expect(cadenceSchema.safeParse({ type: 'weekdays', days: [1, 3] }).success).toBe(true);
    expect(cadenceSchema.safeParse({ type: 'weekdays', days: [] }).success).toBe(false);
    expect(cadenceSchema.safeParse({ type: 'weekdays', days: [3, 1] }).success).toBe(false);
    expect(cadenceSchema.safeParse({ type: 'weekdays', days: [1, 1] }).success).toBe(false);
    expect(cadenceSchema.safeParse({ type: 'weekdays', days: [7] }).success).toBe(false);
  });

  it('comes from a suggestion\'s days of the week, sorted and without repeats', () => {
    expect(cadenceFromSuggestion({ type: 'weekdays', daysOfWeek: [5, 1, 3, 1] })).toEqual(mwf);
    expect(cadenceFromSuggestion({ type: 'weekdays' })).toEqual({ type: 'none' });
  });
});

describe('skips', () => {
  const daily: Cadence = { type: 'daily', timesPerDay: 1 };

  it('excuse a daily habit for the day it was made, and only that day', () => {
    expect(agendaStatus(daily, [], user, now, ['2026-10-03'])).toEqual({ state: 'done' });
    expect(agendaStatus(daily, [], user, now, ['2026-10-02'])).toEqual({ state: 'due' });
  });

  it('fill a several-times-a-day habit however many entries it still needed', () => {
    const water: Cadence = { type: 'daily', timesPerDay: 3 };
    const once = [at('2026-10-03T08:00:00Z')];
    expect(cadenceProgress(water, once, user, now, ['2026-10-03'])).toEqual({ done: 3, needed: 3, period: 'daily' });
    expect(isHabitComplete(water, once, user, now, ['2026-10-03'])).toBe(true);
  });

  it('excuse a weekly or monthly habit for its whole week or month', () => {
    const thriceWeekly: Cadence = { type: 'calendarWeek', times: 3 };
    // Skipped Monday; Saturday is the week's last day
    expect(agendaStatus(thriceWeekly, [], user, now, ['2026-09-28'])).toEqual({ state: 'done' });
    expect(daysUntilDue(thriceWeekly, [], user, now, ['2026-09-28'])).toBeNull();
    // Last week's skip doesn't help
    expect(agendaStatus(thriceWeekly, [], user, now, ['2026-09-26'])).toEqual({ state: 'due' });
    expect(agendaStatus({ type: 'calendarMonth' }, [], user, at('2026-10-31T15:00:00Z'), ['2026-10-01'])).toEqual({ state: 'done' });
  });

  it('excuse an every-N-days habit for the day only, so it\'s due again the next day', () => {
    const everyFourDays: Cadence = { type: 'everyNDays', days: 4 };
    const longAgo = [at('2026-09-01T09:00:00Z')];
    expect(cadenceStatus(everyFourDays, longAgo, user, now)).toEqual({ state: 'due' });
    // Skipped today: done for today, though due again tomorrow
    expect(cadenceStatus(everyFourDays, longAgo, user, now, ['2026-10-03'])).toEqual({ state: 'done' });
    expect(agendaStatus(everyFourDays, longAgo, user, now, ['2026-10-03'])).toEqual({ state: 'done' });
    expect(daysUntilDue(everyFourDays, longAgo, user, now, ['2026-10-03'])).toBe(1);
    // Skipped yesterday: due today, not overdue from the last entry
    expect(cadenceStatus(everyFourDays, longAgo, user, now, ['2026-10-02'])).toEqual({ state: 'due' });
    expect(daysUntilDue(everyFourDays, longAgo, user, now, ['2026-10-02'])).toBe(0);
    expect(skippedCovers(everyFourDays, ['2026-10-02'], user).map(({ from, to }) => [civilDayKey(from), civilDayKey(to)])).toEqual([['2026-10-02', '2026-10-02']]);
  });

  it('excuse a weekday habit on its day', () => {
    const mwf: Cadence = { type: 'weekdays', days: [1, 3, 5] };
    const wednesday = at('2026-09-30T15:00:00Z');
    expect(agendaStatus(mwf, [], user, wednesday, ['2026-09-30'])).toEqual({ state: 'done' });
    // Covers the day off after it too, then it's due Friday
    expect(agendaStatus(mwf, [], user, at('2026-10-01T15:00:00Z'), ['2026-09-30'])).toEqual({ state: 'done' });
    expect(agendaStatus(mwf, [], user, at('2026-10-02T15:00:00Z'), ['2026-09-30'])).toEqual({ state: 'due' });
  });

  it('don\'t count for a habit with no cadence', () => {
    expect(isHabitComplete({ type: 'none' }, [], user, now, ['2026-10-03'])).toBe(false);
    expect(skippedCovers({ type: 'none' }, ['2026-10-03'], user)).toEqual([]);
  });

  it('don\'t make it due at the start of the day', () => {
    // Skipped today: it was due this morning, before the skip
    expect(dueAtStartOfDay(daily, [], user, now, ['2026-10-03'])).toBe(true);
  });

  it('ignore day keys that aren\'t valid', () => {
    expect(agendaStatus(daily, [], user, now, ['yesterday', '2026-02-31'])).toEqual({ state: 'due' });
  });
});

describe('skipState', () => {
  const daily: Cadence = { type: 'daily', timesPerDay: 1 };

  it('offers to skip while it\'s due, named by what a skip covers', () => {
    expect(skipState(daily, [], user, now)).toEqual({ label: 'Skip today', skippedDay: null });
    expect(skipState({ type: 'calendarWeek', times: 2 }, [at('2026-09-28T09:00:00Z')], user, now)).toEqual({ label: 'Skip this week', skippedDay: null });
    // A weekly habit can be skipped before its last day, while it isn't done
    expect(skipState({ type: 'calendarMonth' }, [], user, now)).toEqual({ label: 'Skip this month', skippedDay: null });
    expect(skipState({ type: 'everyNDays', days: 3 }, [], user, now)).toEqual({ label: 'Skip today', skippedDay: null });
  });

  it('offers to undo the skip that\'s excusing it', () => {
    expect(skipState(daily, [], user, now, ['2026-10-03'])).toEqual({ label: 'Skipped today', skippedDay: '2026-10-03' });
    expect(skipState({ type: 'calendarWeek' }, [], user, now, ['2026-09-29'])).toEqual({ label: 'Skipped this week', skippedDay: '2026-09-29' });
    expect(skipState({ type: 'everyNDays', days: 3 }, [], user, now, ['2026-10-03'])).toEqual({ label: 'Skipped today', skippedDay: '2026-10-03' });
    // Yesterday's skip doesn't excuse today
    expect(skipState({ type: 'everyNDays', days: 3 }, [], user, now, ['2026-10-02'])).toEqual({ label: 'Skip today', skippedDay: null });
  });

  it('has nothing to offer once it\'s done, on a day off, or with no cadence', () => {
    expect(skipState(daily, [at('2026-10-03T09:00:00Z')], user, now)).toBeNull();
    expect(skipState({ type: 'weekdays', days: [1, 3, 5] }, [], user, now)).toBeNull();
    expect(skipState({ type: 'none' }, [], user, now)).toBeNull();
  });
});
