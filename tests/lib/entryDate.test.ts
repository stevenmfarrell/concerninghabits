import { describe, expect, it } from 'vitest';
import { whenDone } from '@/lib/entryDate';
import { wallTimeToInstant, zoneOffsetMinutes } from '@/lib/timezone';

const denver = { timeZone: 'America/Denver', bedtime: '01:00' };
// Tuesday, October 13, 2026, 9:30pm in Denver (MDT, UTC-6)
const now = new Date('2026-10-14T03:30:00Z');
const at = (text: string, when = now, user = denver) => whenDone(text, user, when)?.toISOString() ?? null;

describe('whenDone', () => {
  it('reads an earlier day, at noon there when no time is said', () => {
    expect(at('I read yesterday')).toBe('2026-10-12T18:00:00.000Z');
    expect(at('I read 3 days ago')).toBe('2026-10-10T18:00:00.000Z');
    expect(at('I read on october 10th')).toBe('2026-10-10T18:00:00.000Z');
    expect(at('read the day before yesterday')).toBe('2026-10-11T18:00:00.000Z');
    expect(at('read last friday')).toBe('2026-10-09T18:00:00.000Z');
  });

  it('keeps a time said with the day', () => {
    expect(at('read yesterday at 6pm')).toBe('2026-10-13T00:00:00.000Z');
    expect(at('ran 3 miles yesterday morning at 7:15')).toBe('2026-10-12T13:15:00.000Z');
    expect(at('read today at 7am')).toBe('2026-10-13T13:00:00.000Z');
    expect(at('read this morning at 7')).toBe('2026-10-13T13:00:00.000Z');
  });

  it('counts back from the moment for hours and minutes ago', () => {
    expect(at('read 2 hours ago')).toBe('2026-10-14T01:30:00.000Z');
    // Just after midnight, before a 1am bedtime
    expect(at('read 45 minutes ago', new Date('2026-10-14T06:15:00Z'))).toBe('2026-10-14T05:30:00.000Z');
  });

  it('is null when nothing says an earlier day', () => {
    expect(at('read 20 pages')).toBeNull();
    expect(at('read today')).toBeNull();
    expect(at('read this morning')).toBeNull();
    expect(at('ran 5k in 25 minutes')).toBeNull();
    expect(at('read for 30 minutes')).toBeNull();
    expect(at('did 10 pushups at 5')).toBeNull();
    expect(at('read today at 11pm')).toBeNull();
    expect(at('read tomorrow')).toBeNull();
  });

  it('ignores dates written only in numbers', () => {
    expect(at('read 10/10')).toBeNull();
    expect(at('read 1984')).toBeNull();
    expect(at('did the 5/3/1 workout')).toBeNull();
  });

  it('counts days from the user\'s bedtime', () => {
    // 12:30am on Wednesday, before a 1am bedtime: still Tuesday, so yesterday is Monday
    const afterMidnight = new Date('2026-10-14T06:30:00Z');
    expect(at('read yesterday', afterMidnight)).toBe('2026-10-12T18:00:00.000Z');
    expect(at('read yesterday', afterMidnight, { ...denver, bedtime: '00:00' })).toBe('2026-10-13T18:00:00.000Z');
  });

  it('uses the user\'s time zone', () => {
    // 9:30pm Tuesday in Denver is already Wednesday in Tokyo
    expect(at('read yesterday', now, { timeZone: 'Asia/Tokyo', bedtime: '00:00' })).toBe('2026-10-13T03:00:00.000Z');
  });
});

describe('wallTimeToInstant', () => {
  it('lands on the wall time across a clock change', () => {
    // Denver falls back on November 1, 2026: MDT (UTC-6) before, MST (UTC-7) after
    expect(wallTimeToInstant(new Date('2026-10-31T00:00:00Z'), 12, 0, 'America/Denver').toISOString()).toBe('2026-10-31T18:00:00.000Z');
    expect(wallTimeToInstant(new Date('2026-11-02T00:00:00Z'), 12, 0, 'America/Denver').toISOString()).toBe('2026-11-02T19:00:00.000Z');
    expect(zoneOffsetMinutes(new Date('2026-11-02T19:00:00Z'), 'America/Denver')).toBe(-420);
  });
});
