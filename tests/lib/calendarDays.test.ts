import { describe, expect, it } from 'vitest';
import { calendarDays } from '@/lib/calendarDays';
import type { Cadence } from '@/lib/cadence';

const user = { timeZone: 'UTC', bedtime: '00:00', weekStartsOn: 'sunday' };
// Saturday, October 10th 2026, mid-afternoon
const now = new Date('2026-10-10T15:00:00Z');
const day = (d: number) => new Date(Date.UTC(2026, 9, d));
const at = (d: number, hour = 9) => new Date(Date.UTC(2026, 9, d, hour));
const key = (d: number) => `2026-10-${String(d).padStart(2, '0')}`;
// Sunday the 4th through Saturday the 17th: last week, this week, and next week's days to come
const range = { from: day(4), to: day(17), now };

const daily: Cadence = { type: 'daily', timesPerDay: 1 };
const weekly: Cadence = { type: 'calendarWeek' };

describe('calendarDays', () => {
  it('has every day of the range, nothing counted on days still to come', () => {
    const days = calendarDays({ dates: [at(5)], cadence: daily, user, ...range });
    expect([...days.keys()]).toHaveLength(14);
    expect(days.get(key(5))).toMatchObject({ count: 1, counting: 1, isFuture: false, isToday: false });
    expect(days.get(key(10))).toMatchObject({ isToday: true, isFuture: false });
    expect(days.get(key(11))).toMatchObject({ isFuture: true, count: 0, counting: 0, isPeriodCompleted: false });
  });

  it('counts an entry toward the rest of its period, completing days without entries of their own', () => {
    const days = calendarDays({ dates: [at(6)], cadence: weekly, user, ...range });
    expect(days.get(key(6))).toMatchObject({ count: 1, counting: 1, isPeriodCompleted: false });
    expect(days.get(key(4))).toMatchObject({ count: 0, counting: 1, isPeriodCompleted: true });
    // The 4th to the 10th is one week; the 11th starts the next
    expect(days.get(key(10))).toMatchObject({ count: 0, counting: 1, isPeriodCompleted: true });
    expect(days.get(key(11))).toMatchObject({ count: 0, counting: 0, isPeriodCompleted: false });
  });

  it('counts an every-N-days entry for its stretch, clipped to the range', () => {
    const days = calendarDays({ dates: [at(2)], cadence: { type: 'everyNDays', days: 5 }, user, ...range });
    // Its stretch runs from the 2nd to the 6th, so the 4th through the 6th are shown done
    expect([4, 5, 6].map(d => days.get(key(d))?.isPeriodCompleted)).toEqual([true, true, true]);
    expect(days.get(key(7))?.isPeriodCompleted).toBe(false);
    expect(days.has(key(2))).toBe(false);
  });

  it('marks the days a skip or vacation excuses, but not ones done anyway', () => {
    const skipped = calendarDays({ dates: [at(5)], cadence: daily, user, skippedDays: [key(5), key(7)], ...range });
    expect(skipped.get(key(7))?.isSkipped).toBe(true);
    expect(skipped.get(key(5))?.isSkipped).toBe(false);
    const away = calendarDays({ dates: [], cadence: daily, user: { ...user, vacations: [{ from: key(8), to: null }] }, ...range });
    expect([7, 8, 9, 10, 11].map(d => away.get(key(d))?.isSkipped)).toEqual([false, true, true, true, false]);
  });

  it('shades a limit\'s days by keeping to it, once its period is over or as soon as it goes over', () => {
    const coffee: Cadence = { type: 'limit', period: 'day', max: 1 };
    const days = calendarDays({ dates: [at(6), at(7), at(7, 12), at(10)], cadence: coffee, user, since: day(5), ...range });
    expect(days.get(key(4))?.limitShade).toBeNull(); // before it began
    expect(days.get(key(5))?.limitShade).toBe('kept');
    expect(days.get(key(6))?.limitShade).toBe('kept');
    expect(days.get(key(7))?.limitShade).toBe('overLogged');
    expect(days.get(key(10))?.limitShade).toBe('logged'); // today, still going
    expect(days.get(key(11))?.limitShade).toBeNull();
    const weekLimit = calendarDays({ dates: [at(5), at(6)], cadence: { type: 'limit', period: 'week', max: 1 }, user, since: day(1), ...range });
    expect(weekLimit.get(key(8))?.limitShade).toBe('over');
    expect(calendarDays({ dates: [at(5)], cadence: daily, user, ...range }).get(key(5))?.limitShade).toBeNull();
  });

  it('says who logged each day, or who completed its period, when coloring by person', () => {
    const days = calendarDays({ dates: [at(6), at(6, 12), at(9)], loggedBy: ['amy', 'ben', 'ben'], cadence: weekly, user, ...range });
    expect(days.get(key(6))?.loggers).toEqual(['amy', 'ben']);
    expect(days.get(key(4))?.loggers).toEqual(['amy', 'ben']);
    expect(days.get(key(11))?.loggers).toEqual([]);
    // Not for a limit, whose shading is about keeping to it
    const limit = calendarDays({ dates: [at(6)], loggedBy: ['amy'], cadence: { type: 'limit', period: 'day', max: 2 }, user, ...range });
    expect(limit.get(key(6))?.loggers).toEqual([]);
  });
});
