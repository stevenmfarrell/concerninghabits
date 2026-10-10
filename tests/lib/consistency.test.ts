import { describe, expect, it } from 'vitest';
import { consistency, CONSISTENCY_HISTORY_WEEKS, lookbackDays } from '@/lib/consistency';
import type { Cadence } from '@/lib/cadence';

const user = { timeZone: 'UTC', bedtime: '00:00', weekStartsOn: 'sunday' };
// Saturday, October 3rd 2026, mid-afternoon
const now = new Date('2026-10-03T15:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
// 9am on the day `days` before today
const daysAgo = (days: number) => new Date(Date.UTC(2026, 9, 3 - days, 9));
const dayKey = (days: number) => daysAgo(days).toISOString().slice(0, 10);
// An entry on each of these days ago
const on = (days: number[]) => days.map(daysAgo);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const daily: Cadence = { type: 'daily', timesPerDay: 1 };
const longAgo = new Date(now.getTime() - 200 * DAY_MS);
const score = (cadence: Cadence, logs: Date[], options: { createdAt?: Date; skippedDays?: string[] } = {}) =>
  consistency(cadence, logs, user, { createdAt: options.createdAt ?? longAgo, skippedDays: options.skippedDays }, now);

describe('consistency', () => {
  it('has nothing to say about a habit with no cadence', () => {
    expect(score({ type: 'none' }, on(range(0, 30)))).toBeNull();
  });

  it('is freshly planted until there have been a few chances to do it', () => {
    expect(score(daily, on([1, 2]), { createdAt: daysAgo(2) })).toEqual({ level: 'freshlyPlanted', score: null, trend: null });
    expect(score(daily, on([1, 2, 3]), { createdAt: daysAgo(3) })?.level).toBe('thriving');
  });

  it('is thriving for a habit done every time', () => {
    expect(score(daily, on(range(1, 100)))).toEqual({ level: 'thriving', score: 1, trend: null });
  });

  it('doesn\'t hold today against it before it\'s over, but counts it once it\'s done', () => {
    expect(score(daily, on(range(1, 100)))?.score).toBe(1);
    expect(score(daily, on(range(0, 100)))?.score).toBe(1);
  });

  it('only dips a little for one miss, rather than starting over like a streak', () => {
    const missedYesterday = score(daily, on(range(2, 100)));
    expect(missedYesterday?.level).toBe('thriving');
    expect(missedYesterday?.score).toBeGreaterThan(0.95);
    expect(missedYesterday?.score).toBeLessThan(1);
  });

  it('needs care when it hasn\'t been done', () => {
    expect(score(daily, [])).toEqual({ level: 'needsCare', score: 0, trend: null });
  });

  it('recovers as the habit is picked back up, trending up', () => {
    // Two weeks back at it after a long gap
    const comingBack = score(daily, on(range(1, 14)));
    expect(comingBack?.trend).toBe('up');
    expect(comingBack?.score).toBeGreaterThan(0.3);
    // A month back at it and it's taking root
    expect(score(daily, on(range(1, 30)))?.level).toBe('takingRoot');
  });

  it('trends down as it slips', () => {
    expect(score(daily, on(range(8, 100)))?.trend).toBe('down');
  });

  it('weighs recent weeks more than older ones', () => {
    const recentMisses = score(daily, on(range(8, 100)))!.score!;
    const olderMisses = score(daily, on([...range(1, 40), ...range(48, 100)]))!.score!;
    expect(recentMisses).toBeLessThan(olderMisses);
  });

  it('doesn\'t count skipped days either way', () => {
    const skipped = range(1, 20).filter(d => d % 3 === 0);
    const logs = on(range(1, 100).filter(d => !skipped.includes(d)));
    expect(score(daily, logs, { skippedDays: skipped.map(dayKey) })?.score).toBe(1);
    expect(score(daily, logs)?.score).toBeLessThan(1);
  });

  it('doesn\'t count days before the habit existed, or before it counts back to', () => {
    expect(score(daily, on(range(1, 10)), { createdAt: daysAgo(10) })?.score).toBe(1);
    // Entries imported from before it was created count from when they begin
    expect(score(daily, on(range(1, 20)), { createdAt: daysAgo(5) })?.score).toBe(1);
    // Nothing older than the score looks back to matters
    expect(score(daily, on(range(1, lookbackDays(daily))))?.score).toBe(1);
  });

  it('gives part credit for a habit done part as often as it takes', () => {
    const twiceDaily: Cadence = { type: 'daily', timesPerDay: 2 };
    const oncePerDay = score(twiceDaily, on(range(1, 100)));
    expect(oncePerDay?.score).toBeCloseTo(0.5);
    expect(oncePerDay?.level).toBe('takingRoot');
  });

  it('counts a weekday habit only on its days', () => {
    // Mondays, Wednesdays and Fridays; October 3rd is a Saturday, so 1, 3 and 5 days ago are
    // Friday, Wednesday and Monday
    const mwf: Cadence = { type: 'weekdays', days: [1, 3, 5] };
    const theirDays = range(1, 100).filter(d => [1, 3, 5].includes(daysAgo(d).getUTCDay()));
    expect(score(mwf, on(theirDays))?.score).toBe(1);
    expect(score(mwf, on(theirDays.filter((_, i) => i % 2 === 0)))?.level).toBe('takingRoot');
  });

  it('counts a weekly habit by its weeks, with part credit', () => {
    const twiceWeekly: Cadence = { type: 'calendarWeek', times: 2 };
    // Every Monday and Thursday
    const twice = range(1, 100).filter(d => [1, 4].includes(daysAgo(d).getUTCDay()));
    expect(score(twiceWeekly, on(twice))?.score).toBe(1);
    // Only Mondays: half of each week
    const once = range(1, 100).filter(d => daysAgo(d).getUTCDay() === 1);
    expect(score(twiceWeekly, on(once))?.score).toBeCloseTo(0.5, 1);
  });

  it('scores an every-N-days habit by how often it\'s done against how often it\'s meant to be', () => {
    const everyThreeDays: Cadence = { type: 'everyNDays', days: 3 };
    const every = (n: number) => score(everyThreeDays, on(range(1, 200).filter(d => d % n === 0)))!.score!;
    expect(every(3)).toBe(1);
    expect(every(4)).toBeCloseTo(0.75, 1);
    expect(every(6)).toBeCloseTo(0.5, 1);
    // A day late always costs something, and more lateness costs more
    expect(every(4)).toBeLessThan(1);
    expect(every(5)).toBeLessThan(every(4));
    expect(every(6)).toBeLessThan(every(5));
  });

  it('counts each stretch an every-N-days habit has gone undone as missed', () => {
    const everyThreeDays: Cadence = { type: 'everyNDays', days: 3 };
    // Done 10 days ago, due 7 days ago, and two whole stretches gone by since
    const neglected = score(everyThreeDays, on([10]), { createdAt: daysAgo(10) });
    expect(neglected?.level).toBe('needsCare');
    expect(neglected?.score).toBeCloseTo(1 / 3, 1);
  });

  it('gives a monthly habit a score, and isn\'t swung by one missed month', () => {
    const monthly: Cadence = { type: 'calendarMonth' };
    // Every month for the last year
    const everyMonth = range(1, 12).map(m => new Date(Date.UTC(2026, 9 - m, 10, 9)));
    expect(score(monthly, everyMonth)?.level).toBe('thriving');
    // ...except last month
    expect(score(monthly, everyMonth.slice(1))?.level).toBe('takingRoot');
  });

  it('loads enough history for the score and its trend', () => {
    for (const cadence of [daily, { type: 'calendarMonth' }, { type: 'everyNDays', days: 365 }] as Cadence[]) {
      expect(CONSISTENCY_HISTORY_WEEKS * 7).toBeGreaterThanOrEqual(lookbackDays(cadence) + 7);
    }
  });
});
