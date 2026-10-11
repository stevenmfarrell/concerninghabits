import { describe, expect, it } from 'vitest';
import {
  dayMinute, describeReminder, formatDayMinute, GROUP_WAIT, learnUsualTime, MAX_PER_DAY, MAX_SPREAD, nudgeTime, pickNudge,
  reminderMessage, reminderStatusFor, shouldMute, usualTimeSamples, type Candidate, type ReminderStatus,
} from '@/lib/reminders';

const user = { timeZone: 'America/Denver', bedtime: '01:00' };
// 11:40pm in Denver (MDT, UTC-6) on each of the days before Friday, October 9th 2026
const lateEvening = (day: number) => new Date(Date.UTC(2026, 9, day + 1, 5, 40));
const now = new Date('2026-10-09T18:00:00Z'); // noon in Denver

const candidate = (habitId: string, at: number, manual = false): Candidate => ({ habitId, name: habitId, at, manual, usual: null, progress: null });

describe('dayMinute', () => {
  it('counts from the bedtime, so just after midnight is late in the day', () => {
    expect(dayMinute(lateEvening(8), user.timeZone, user.bedtime)).toBe(22 * 60 + 40);
    // 12:30am on the 9th, still the 8th by a 01:00 bedtime
    expect(dayMinute(new Date('2026-10-09T06:30:00Z'), user.timeZone, user.bedtime)).toBe(23 * 60 + 30);
    expect(dayMinute(new Date('2026-10-09T07:00:00Z'), user.timeZone, user.bedtime)).toBe(0);
  });

  it('formats back to the clock', () => {
    expect(formatDayMinute(22 * 60 + 40, user.bedtime)).toBe('11:40 PM');
    expect(formatDayMinute(23 * 60 + 30, user.bedtime)).toBe('12:30 AM');
  });
});

describe('usualTimeSamples', () => {
  it('takes one time per past day, leaving out today', () => {
    const logs = [lateEvening(5), lateEvening(6), lateEvening(7), new Date('2026-10-09T15:00:00Z')];
    expect(usualTimeSamples(logs, 0, user, now)).toEqual([1360, 1360, 1360]);
  });

  it('takes the entry numbered entryIndex on each day, for a habit done several times a day', () => {
    const morning = (day: number) => new Date(Date.UTC(2026, 9, day, 14, 0)); // 8am
    const afternoon = (day: number) => new Date(Date.UTC(2026, 9, day, 20, 0)); // 2pm
    const logs = [afternoon(7), morning(7), morning(6), afternoon(6), morning(5)];
    expect(usualTimeSamples(logs, 1, user, now)).toEqual([13 * 60, 13 * 60]);
  });
});

describe('learnUsualTime', () => {
  it('needs enough days to learn from', () => {
    expect(learnUsualTime([600, 610])).toEqual({ kind: 'tooFew', samples: 2, latest: 610 });
  });

  it('runs late at the 80th percentile', () => {
    const learned = learnUsualTime([600, 620, 640, 660, 700]);
    expect(learned).toEqual({ kind: 'learned', usual: 640, lateAt: 668 });
  });

  it('gives a habit always done at the same time some margin', () => {
    expect(learnUsualTime([600, 600, 600, 600, 600])).toMatchObject({ lateAt: 620 });
  });

  it('never runs late too close to the end of the day', () => {
    expect(learnUsualTime([1420, 1430, 1435, 1438, 1439])).toMatchObject({ lateAt: 1425 });
  });

  it('gives up on times that are all over the place', () => {
    expect(learnUsualTime([0, 0, 0, MAX_SPREAD + 10, MAX_SPREAD + 10, MAX_SPREAD + 10])).toEqual({ kind: 'irregular' });
  });
});

describe('nudgeTime', () => {
  it('prefers a set time, counted from the bedtime', () => {
    expect(nudgeTime('21:00', { kind: 'irregular' }, '01:00')).toEqual({ at: 20 * 60, manual: true, source: 'set' });
  });

  it('falls back to the learned time', () => {
    expect(nudgeTime(null, { kind: 'learned', usual: 600, lateAt: 650 }, '01:00')).toEqual({ at: 650, manual: false, source: 'learned' });
  });

  it('defaults to 7pm without enough history, or with times all over the place', () => {
    const sevenPm = 18 * 60; // with a 01:00 bedtime
    expect(nudgeTime(null, { kind: 'tooFew', samples: 0, latest: null }, '01:00')).toEqual({ at: sevenPm, manual: true, source: 'default' });
    expect(nudgeTime(null, { kind: 'tooFew', samples: 2, latest: 600 }, '01:00')).toMatchObject({ at: sevenPm });
    expect(nudgeTime(null, { kind: 'irregular' }, '01:00')).toMatchObject({ at: sevenPm });
  });

  it('moves the default later for a habit whose few entries came later', () => {
    // Two entries so far, the later at 11:40pm: nudged at midnight, not 7pm
    expect(nudgeTime(null, { kind: 'tooFew', samples: 2, latest: 22 * 60 + 40 }, '01:00')).toMatchObject({ at: 23 * 60 });
  });
});

describe('pickNudge', () => {
  it('waits a while after a learned time, in case others run late too', () => {
    const habits = [candidate('a', 600), candidate('b', 615)];
    expect(pickNudge(habits, 610, 0)).toEqual([]);
    expect(pickNudge(habits, 600 + GROUP_WAIT, 0).map(c => c.habitId)).toEqual(['a', 'b']);
  });

  it('keeps to a set time', () => {
    expect(pickNudge([candidate('a', 600, true)], 600, 0).map(c => c.habitId)).toEqual(['a']);
  });

  it('leaves out habits not late yet', () => {
    expect(pickNudge([candidate('a', 600, true), candidate('b', 900)], 600, 0).map(c => c.habitId)).toEqual(['a']);
  });

  it('stops once the day\'s notifications are used up', () => {
    expect(pickNudge([candidate('a', 600, true)], 700, MAX_PER_DAY)).toEqual([]);
  });
});

describe('shouldMute', () => {
  it('mutes after five unanswered in a row', () => {
    expect(shouldMute([false, false, false, false, false])).toBe(true);
    expect(shouldMute([false, false, false, false, true])).toBe(false);
    expect(shouldMute([false, false, false, false])).toBe(false);
  });
});

describe('reminderMessage', () => {
  it('names a single habit and when it\'s usually done, linking to it', () => {
    expect(reminderMessage([{ ...candidate('meds', 1385), name: 'Meds', usual: 1360 }], '01:00')).toEqual({
      title: 'Meds',
      body: 'Not logged yet. You usually do this around 11:40 PM.',
      url: '/log/meds',
    });
  });

  it('says how far along a habit done several times a day is, and when it\'s usually further', () => {
    const water = { ...candidate('water', 800), name: 'Water', usual: 720, progress: { done: 3, needed: 8 } };
    expect(reminderMessage([water], '01:00').body).toBe("3 of 8 so far. You're usually at 4 by 1:00 PM.");
    expect(reminderMessage([{ ...water, usual: null }], '01:00').body).toBe('3 of 8 so far today.');
  });

  it('gives each habit done several times a day its progress in a list', () => {
    const water = { ...candidate('w', 1), name: 'Water', progress: { done: 3, needed: 8 } };
    expect(reminderMessage([water, candidate('Stretch', 2)], '01:00').body).toBe('Water (3 of 8), Stretch');
  });

  it('lists several together, linking to the Agenda', () => {
    expect(reminderMessage([candidate('Vitamins', 1), candidate('Stretch', 2)], '01:00')).toEqual({ title: 'Running behind', body: 'Vitamins, Stretch', url: '/' });
  });
});

describe('describeReminder', () => {
  const learned = { kind: 'learned' as const, usual: 1360, lateAt: 1385 };

  it('explains what a learned reminder will do', () => {
    expect(describeReminder({ enabled: true, remindAt: null, muted: false, learned, progress: null }, '01:00'))
      .toBe("You usually log this around 11:40 PM. If it isn't logged by 12:05 AM on a day it's due, you'll get a nudge.");
  });

  it('describes a habit done several times a day by its next entry', () => {
    const progress = { done: 3, needed: 8 };
    expect(describeReminder({ enabled: true, remindAt: null, muted: false, learned: { kind: 'learned', usual: 720, lateAt: 750 }, progress }, '01:00'))
      .toBe("You're usually at 4 of 8 by 1:00 PM. If you aren't by 1:30 PM, you'll get a nudge. This moves on with each entry you log.");
    expect(describeReminder({ enabled: true, remindAt: '21:00', muted: false, learned, progress }, '01:00'))
      .toBe("If you aren't at 8 by 9:00 PM on a day it's due, you'll get a nudge.");
    expect(describeReminder({ enabled: true, remindAt: null, muted: false, learned: { kind: 'tooFew', samples: 2, latest: null }, progress }, '01:00'))
      .toBe("If you aren't at 8 by 7:00 PM on a day it's due, you'll get a nudge. Once it's been logged on 5 days (2 so far), it'll go by when you usually reach 4 of 8 instead.");
  });

  it('explains the default time while it\'s still learning', () => {
    expect(describeReminder({ enabled: true, remindAt: null, muted: false, learned: { kind: 'tooFew', samples: 1, latest: 600 }, progress: null }, '01:00'))
      .toBe("If it isn't logged by 7:00 PM on a day it's due, you'll get a nudge. Once it's been logged on 5 days (1 so far), it'll go by when you usually do this instead.");
  });

  it('says when it\'s paused', () => {
    expect(describeReminder({ enabled: true, remindAt: null, muted: true, learned, progress: null }, '01:00')).toMatch(/^Paused/);
  });
});

describe('reminderStatusFor', () => {
  const base: ReminderStatus = { enabled: true, remindAt: null, muted: false, learned: { kind: 'tooFew', samples: 0, latest: null }, progress: null };

  it('gives a habit switched to several times a day its progress, so it reads entry by entry', () => {
    const status = reminderStatusFor(base, { type: 'daily', timesPerDay: 3 });
    expect(status.progress).toEqual({ done: 0, needed: 3 });
    expect(describeReminder(status, '00:00')).toContain("If you aren't at 3 by");
  });

  it('keeps today\'s entries so far, short of done', () => {
    const atTwo = { ...base, progress: { done: 2, needed: 5 } };
    expect(reminderStatusFor(atTwo, { type: 'daily', timesPerDay: 3 }).progress).toEqual({ done: 2, needed: 3 });
    expect(reminderStatusFor(atTwo, { type: 'daily', timesPerDay: 2 }).progress).toEqual({ done: 1, needed: 2 });
  });

  it('drops the progress for once a day or any other cadence, and leaves an unchanged status as it is', () => {
    const multi = { ...base, progress: { done: 1, needed: 3 } };
    expect(reminderStatusFor(multi, { type: 'daily', timesPerDay: 1 }).progress).toBeNull();
    expect(reminderStatusFor(multi, { type: 'calendarWeek', times: 3 }).progress).toBeNull();
    expect(reminderStatusFor(multi, { type: 'daily', timesPerDay: 3 })).toBe(multi);
    expect(describeReminder(reminderStatusFor(multi, { type: 'daily', timesPerDay: 1 }), '00:00')).toContain("If it isn't logged by");
  });
});
