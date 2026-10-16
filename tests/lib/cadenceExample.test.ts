import { describe, expect, it } from 'vitest';
import { cadenceExample } from '@/lib/cadenceExample';

// Thursday, October 15th 2026, and Saturday the 17th, the last day of a week starting Sunday
const thursday = new Date(Date.UTC(2026, 9, 15));
const saturday = new Date(Date.UTC(2026, 9, 17));

describe('cadenceExample', () => {
  it('counts every N days from today', () => {
    expect(cadenceExample({ type: 'everyNDays', days: 7 }, thursday, 'sunday')).toBe('Do it today (Thursday), and it\'s due again 7 days later, on Thursday, October 22.');
    expect(cadenceExample({ type: 'everyNDays', days: 3 }, thursday, 'sunday')).toBe('Do it today (Thursday), and it\'s due again 3 days later, on Sunday, October 18.');
  });

  it('starts a calendar week over on the user\'s week start, however soon', () => {
    expect(cadenceExample({ type: 'calendarWeek' }, thursday, 'sunday')).toBe('Do it today (Thursday), and it\'s done for this week. A new week starts Sunday.');
    expect(cadenceExample({ type: 'calendarWeek' }, saturday, 'sunday')).toBe('Do it today (Saturday), and it\'s done for this week. A new week starts tomorrow (Sunday).');
    expect(cadenceExample({ type: 'calendarWeek', times: 3 }, thursday, 'monday')).toBe('It\'s done once it\'s logged 3 times in a week, on any days. Your weeks run Monday to Sunday, so a new one starts Monday.');
  });

  it('starts a calendar month over on the 1st', () => {
    expect(cadenceExample({ type: 'calendarMonth' }, thursday, 'sunday')).toBe('Do it today (October 15), and it\'s done for October. A new month starts November 1.');
    expect(cadenceExample({ type: 'calendarMonth', times: 2 }, new Date(Date.UTC(2026, 11, 31)), 'sunday')).toBe('It\'s done once it\'s logged 2 times in a month, on any days. A new month starts January 1.');
  });

  it('has nothing to say for other cadences', () => {
    expect(cadenceExample({ type: 'daily', timesPerDay: 1 }, thursday, 'sunday')).toBeNull();
  });
});
