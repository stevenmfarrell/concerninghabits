import { describe, expect, it } from 'vitest';
import { calendarStart } from '@/lib/calendarRange';
import { civilDayKey } from '@/lib/timezone';

const day = (key: string) => new Date(`${key}T00:00:00Z`);
const start = (today: string, weeks: number, weekStartsOn = 'sunday', wholeMonths = true) =>
  civilDayKey(calendarStart(day(today), weeks, weekStartsOn, wholeMonths));

describe('calendarStart', () => {
  it('starts a few weeks at the week start (weeks - 1) weeks back, without whole months', () => {
    // Sunday Oct 4, 2026: this week starts Oct 4, four weeks before that is Sep 6
    expect(start('2026-10-04', 5, 'sunday', false)).toBe('2026-09-06');
    expect(start('2026-10-04', 5, 'monday', false)).toBe('2026-08-31');
  });

  it('goes back to the 1st when the first week begins partway through a month', () => {
    expect(start('2026-10-04', 5)).toBe('2026-09-01');
    // Monday weeks: the first week starts Aug 31, so the calendar starts Aug 1
    expect(start('2026-10-04', 5, 'monday')).toBe('2026-08-01');
  });

  it('keeps a first week that already starts on the 1st', () => {
    // Sunday Nov 29, 2026: four weeks before its week start is Sunday Nov 1
    expect(start('2026-11-29', 5)).toBe('2026-11-01');
  });

  it('starts a few months on the 1st of the month `weeks` weeks back', () => {
    expect(start('2026-10-04', 26)).toBe('2026-04-01');
  });

  it('starts a year on the 1st, 11 months back', () => {
    expect(start('2026-10-04', 52)).toBe('2025-11-01');
  });
});
