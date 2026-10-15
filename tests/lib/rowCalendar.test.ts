import { describe, expect, it } from 'vitest';
import { calendarDays, summarizeCalendar, summarizedDay } from '@/lib/calendarDays';
import { calendarSpan } from '@/lib/calendarRange';
import { civilDateFor, addDays } from '@/lib/timezone';
import type { Cadence } from '@/lib/cadence';
import { categoryRowCalendar, toRowHabit } from '@/lib/rowCalendar';

const user = { timeZone: 'America/Denver', bedtime: '01:00', weekStartsOn: 'monday', vacations: [{ from: '2026-10-01', to: '2026-10-02' }] };
// Saturday, October 10th 2026, mid-afternoon in Denver
const now = new Date('2026-10-10T21:00:00Z');
const at = (month: number, d: number, hour = 15) => new Date(Date.UTC(2026, month - 1, d, hour));
// A year of entries every other day, and a few skips
const dates = Array.from({ length: 180 }, (_, i) => new Date(now.getTime() - i * 2 * 864e5 - 3600e3));
const loggedBy = dates.map((_, i) => (i % 3 === 0 ? 'pat' : 'sam'));
const skippedDays = ['2026-10-07', '2026-09-30'];

const cadences: Record<string, Cadence> = {
  daily: { type: 'daily', timesPerDay: 2 },
  weekly: { type: 'calendarWeek' },
  monthly: { type: 'calendarMonth' },
  everyNDays: { type: 'everyNDays', days: 3 },
  limit: { type: 'limit', period: 'week', max: 3 },
};

// What the calendar draws for each day it shows, worked out from the entries or from a summary
function drawn(input: { weeks: number; wholeMonths: boolean; summary?: ReturnType<typeof summarizeCalendar>; cadence: Cadence; loggedBy?: string[]; since?: Date }) {
  const today = civilDateFor(now, user);
  const { from, to } = calendarSpan(today, input.weeks, user.weekStartsOn, input.wholeMonths);
  const direct = calendarDays({ dates, loggedBy: input.loggedBy, cadence: input.cadence, user, skippedDays, since: input.since, from, to, now });
  const days = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(input.summary ? summarizedDay(input.summary, day, today) : direct.get(day.toISOString().slice(0, 10))!);
  return days;
}

describe('summarizeCalendar', () => {
  for (const [name, cadence] of Object.entries(cadences)) {
    it(`draws the same days as the entries would, for a ${name} cadence`, () => {
      for (const { weeks, wholeMonths } of [{ weeks: 4, wholeMonths: false }, { weeks: 13, wholeMonths: true }, { weeks: 52, wholeMonths: true }]) {
        const shared = name === 'limit' ? undefined : loggedBy;
        const summary = summarizeCalendar({ dates, loggedBy: shared, cadence, user, skippedDays, since: at(1, 1), weeks, wholeMonths, now });
        expect(drawn({ weeks, wholeMonths, summary, cadence })).toEqual(drawn({ weeks, wholeMonths, cadence, loggedBy: shared, since: at(1, 1) }));
        // Without when it began, its first entry says, however old
        const sinceFirst = summarizeCalendar({ dates, loggedBy: shared, cadence, user, skippedDays, weeks, wholeMonths, now });
        expect(drawn({ weeks, wholeMonths, summary: sinceFirst, cadence })).toEqual(drawn({ weeks, wholeMonths, cadence, loggedBy: shared }));
      }
    });
  }

  it('keeps only the days with something on them, without the defaults', () => {
    const summary = summarizeCalendar({ dates: [at(10, 9)], cadence: { type: 'daily', timesPerDay: 1 }, user: { ...user, vacations: [] }, weeks: 4, wholeMonths: false, now });
    expect(summary).toEqual({ '2026-10-09': { count: 1, counting: 1 } });
  });
});

describe('toRowHabit', () => {
  const habit = {
    id: 'h1', name: 'Run', schema: '{}', cadence: JSON.stringify({ type: 'daily', timesPerDay: 1 }), userId: 'sam', createdAt: at(1, 1),
    logs: dates.map((createdAt, i) => ({ createdAt, userId: loggedBy[i] })), skips: [{ day: '2026-10-07' }],
  };

  it('replaces its entries and skips with four weeks of calendar, saying who logged a shared one', () => {
    const row = toRowHabit({ ...habit, memberCount: 2 }, user);
    expect(row).not.toHaveProperty('logs');
    expect(row).not.toHaveProperty('skips');
    expect(Object.keys(row.calendar!).every(key => key >= '2026-09-14')).toBe(true);
    expect(Object.values(row.calendar!).some(day => day.loggers?.includes('pat'))).toBe(true);
    // Half a year of entries comes down to a few dozen bytes for each of its four weeks' days
    expect(JSON.stringify(row).length).toBeLessThan(JSON.stringify(habit).length / 10);
  });

  it('leaves who logged out for a habit only its owner has', () => {
    const row = toRowHabit({ ...habit, logs: habit.logs.map(l => ({ ...l, userId: 'sam' })), memberCount: 1 }, user);
    expect(Object.values(row.calendar!).some(day => day.loggers)).toBe(false);
  });
});

describe('categoryRowCalendar', () => {
  it('shades a category without a cadence by how many of its habits were logged', () => {
    const habits = [
      { id: 'a', name: 'A', schema: '{}', cadence: '{}', userId: 'sam', logs: [{ createdAt: at(10, 9), userId: 'sam' }] },
      { id: 'b', name: 'B', schema: '{}', cadence: '{}', userId: 'sam', logs: [{ createdAt: at(10, 9, 18), userId: 'sam' }] },
    ];
    expect(categoryRowCalendar(habits, { type: 'none' }, { ...user, vacations: [] }, [], now)['2026-10-09']).toEqual({ count: 2, counting: 2 });
  });
});
