import { describe, expect, it } from 'vitest';
import { loggedOn, summarizeValues, TOAST_DURATIONS, TOAST_OPTIONS } from '@/components/toasts/notify';

describe('summarizeValues', () => {
  it('puts an entry\'s values on one line, leaving out empty ones', () => {
    const properties = {
      distance: { type: 'number', title: 'Distance', 'x-unit': 'miles' },
      time: { type: 'number', title: 'Time', 'x-widget': 'duration' },
      notes: { type: 'string', title: 'Notes' },
    } as const;
    expect(summarizeValues({ distance: 3.1, time: 28, notes: '' }, properties)).toBe('Distance 3.1 miles · Time 28:00');
    expect(summarizeValues({}, properties)).toBe('');
  });
});

describe('loggedOn', () => {
  const today = new Date(2026, 10, 15, 12);

  it('says nothing for today, and names any other day', () => {
    expect(loggedOn(undefined, today)).toBe('');
    expect(loggedOn(new Date(2026, 10, 15, 8), today)).toBe('');
    expect(loggedOn(new Date(2026, 10, 14, 20), today)).toBe('For yesterday');
    expect(loggedOn(new Date(2026, 10, 10, 9), today)).toMatch(/^For .*Nov.*10/);
  });
});

describe('TOAST_OPTIONS', () => {
  it('keeps a loading toast until it\'s replaced, and errors up a little longer than the rest', () => {
    expect(TOAST_OPTIONS.loading?.duration).toBe(Infinity);
    expect(TOAST_OPTIONS.duration).toBe(TOAST_DURATIONS.info);
    expect(TOAST_OPTIONS.error?.duration).toBeGreaterThan(TOAST_DURATIONS.info);
  });
});
