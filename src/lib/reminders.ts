import { civilDateFor, civilDayKey, parseBedtimeOffsetMinutes, todayKeyFor } from './timezone';
import type { Cadence } from './cadence';

// Habit reminders: a nudge when you're running late on a habit, judged against when you usually log
// it, rather than at a fixed time of day. A habit you always do at bedtime isn't late at 9pm.
//
// Times here are "day minutes": minutes into the user's day, which starts at their bedtime (the
// end-of-day setting, see parseBedtimeOffsetMinutes), not at midnight. With a 01:00 bedtime, 11:40pm
// is day minute 1300 and 12:30am is 1410, so an entry just after midnight still sorts as late in
// the evening, the same as the calendars count it toward that day.
//
// Everything in this file is pure, so it can be tested without a database or a clock; the
// scheduler (see reminderScheduler.ts) feeds it and sends what it decides.

const MINUTES_PER_DAY = 24 * 60;

// How many past days a habit needs an entry on before its usual time can be learned
export const MIN_SAMPLES = 5;
// How many of the most recent days to learn from, so a changed routine is picked up within weeks
export const MAX_SAMPLES = 20;
// How late in your usual range a habit counts as running late: by the 80th percentile you've
// normally done it 4 days in 5
export const LATE_PERCENTILE = 0.8;
// At least this long after the usual time, so a habit always done at the same minute isn't
// nudged the moment it's usual
export const MIN_LATE_MARGIN = 20;
// A habit whose middle 60% of times spread wider than this (20th to 80th percentile) has no
// usual time to be late against
export const MAX_SPREAD = 4 * 60;
// How long after a habit runs late to wait before nudging, so others falling due around then go
// in the same notification
export const GROUP_WAIT = 30;
// No nudge is ever later than this before the end of the day, after which the habit would count as
// missed rather than late
export const END_OF_DAY_MARGIN = 15;
// When to nudge about a habit whose usual time can't be learned (too little history, or times all
// over the place) and that has no time set
export const DEFAULT_REMIND_AT = '19:00';
// At most this many notifications a day, however many habits run late
export const MAX_PER_DAY = 3;
// Reminders for a habit pause after this many in a row went unanswered (it wasn't logged that day)
export const IGNORED_LIMIT = 5;

const LATEST_NUDGE = MINUTES_PER_DAY - END_OF_DAY_MARGIN;

const minuteFormatters = new Map<string, Intl.DateTimeFormat>();

function getMinuteFormatter(timeZone: string) {
  let formatter = minuteFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
    minuteFormatters.set(timeZone, formatter);
  }
  return formatter;
}

// Minutes after local midnight ("HH:MM" -> minutes), or null if it isn't a time in that form
export function parseClockTime(time: string | null | undefined) {
  const match = time?.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

const toDayMinute = (clockMinute: number, bedtime: string) =>
  (clockMinute - parseBedtimeOffsetMinutes(bedtime) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

// An instant as minutes into the user's day (see the top of this file)
export function dayMinute(instant: Date, timeZone: string, bedtime: string) {
  const parts = getMinuteFormatter(timeZone).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value);
  return toDayMinute(part('hour') * 60 + part('minute'), bedtime);
}

// A day minute as a 24-hour time, the form a time input and `remindAt` take ("23:40")
export function clockTimeOf(minute: number, bedtime: string) {
  const clock = (Math.round(minute) + parseBedtimeOffsetMinutes(bedtime)) % MINUTES_PER_DAY;
  return `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
}

// A day minute as a time on the clock, e.g. "11:40 PM"
export function formatDayMinute(minute: number, bedtime: string) {
  const clock = (Math.round(minute) + parseBedtimeOffsetMinutes(bedtime)) % MINUTES_PER_DAY;
  return new Date(Date.UTC(2000, 0, 1, Math.floor(clock / 60), clock % 60))
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

// The value `p` of the way through sorted `values` (0 to 1), between neighbors where it falls between them
function percentile(sorted: number[], p: number) {
  const at = (sorted.length - 1) * p;
  const below = Math.floor(at);
  const above = Math.min(below + 1, sorted.length - 1);
  return sorted[below] + (sorted[above] - sorted[below]) * (at - below);
}

export interface User {
  timeZone: string;
  bedtime: string;
}

// When the user usually logs a habit on the days they log it, as day minutes: on each past day
// (today left out, since it isn't over), the time of the entry numbered `entryIndex` (0 for the
// first). A habit done several times a day passes how many it's had today, so its second
// reminder of the day is judged against when its second entry usually comes. Most recent days
// first, at most MAX_SAMPLES of them.
export function usualTimeSamples(logDates: Date[], entryIndex: number, user: User, now: Date) {
  const today = todayKeyFor(user, now);
  const byDay = new Map<string, Date[]>();
  for (const date of logDates) {
    const day = civilDayKey(civilDateFor(date, user));
    if (day === today) continue;
    byDay.set(day, [...(byDay.get(day) ?? []), date]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([, dates]) => dates.sort((a, b) => a.getTime() - b.getTime())[entryIndex])
    .filter((date): date is Date => !!date)
    .slice(0, MAX_SAMPLES)
    .map(date => dayMinute(date, user.timeZone, user.bedtime));
}

// When a habit counts as running late, worked out from its past times (day minutes)
export type LearnedTime =
  | { kind: 'learned'; usual: number; lateAt: number }
  // Logged on fewer than MIN_SAMPLES days so far; `latest` is the latest time among them, if any
  | { kind: 'tooFew'; samples: number; latest: number | null }
  // Logged at times too spread out to have a usual one (see MAX_SPREAD)
  | { kind: 'irregular' };

export function learnUsualTime(samples: number[]): LearnedTime {
  if (samples.length < MIN_SAMPLES) return { kind: 'tooFew', samples: samples.length, latest: samples.length ? Math.max(...samples) : null };
  const sorted = [...samples].sort((a, b) => a - b);
  const usual = percentile(sorted, 0.5);
  const late = percentile(sorted, LATE_PERCENTILE);
  if (late - percentile(sorted, 1 - LATE_PERCENTILE) > MAX_SPREAD) return { kind: 'irregular' };
  return { kind: 'learned', usual, lateAt: Math.min(Math.max(late, usual + MIN_LATE_MARGIN), LATEST_NUDGE) };
}

// Where a habit's nudge time comes from: the time the user set, its learned usual time, or the
// default for when neither is known
export type NudgeSource = 'set' | 'learned' | 'default';

// When to nudge about a habit today, as a day minute: the time the user set ("HH:MM"), else when it
// runs late by its learned time, else DEFAULT_REMIND_AT. The default moves later for a habit whose
// few entries so far came later than it, so something done at bedtime isn't nudged at 7pm while
// its usual time is still being learned. A set or default time is kept to (`manual`); a learned one
// waits to group with others (see pickNudge).
export function nudgeTime(remindAt: string | null, learned: LearnedTime, bedtime: string): { at: number; manual: boolean; source: NudgeSource } {
  const clock = parseClockTime(remindAt);
  if (clock !== null) return { at: toDayMinute(clock, bedtime), manual: true, source: 'set' };
  if (learned.kind === 'learned') return { at: learned.lateAt, manual: false, source: 'learned' };
  const fallback = toDayMinute(parseClockTime(DEFAULT_REMIND_AT)!, bedtime);
  const afterLatest = learned.kind === 'tooFew' && learned.latest !== null ? learned.latest + MIN_LATE_MARGIN : 0;
  return { at: Math.min(Math.max(fallback, afterLatest), LATEST_NUDGE), manual: true, source: 'default' };
}

// How far through today a habit done several times a day is, e.g. 3 of 8 glasses of water. Its
// learned time is for its next entry (the 4th), so that's what its reminder talks about.
export interface DayProgress {
  done: number;
  needed: number;
}

export interface Candidate {
  habitId: string;
  name: string;
  // Its nudge time today (see nudgeTime)
  at: number;
  manual: boolean;
  // Its usual time, for the message, when it was learned
  usual: number | null;
  // For a habit done several times a day; null for one done once
  progress: DayProgress | null;
}

// Which habits to nudge about now, in one notification, or none yet. Only habits that are still due
// and haven't been mentioned today are candidates. A set time is kept to; a learned one waits
// GROUP_WAIT minutes in case others run late around then (but never past the end of the day).
// Then every candidate already late goes in, so one notification covers them all. Nothing once the
// day's MAX_PER_DAY notifications are used up.
export function pickNudge(candidates: Candidate[], now: number, sentToday: number): Candidate[] {
  if (sentToday >= MAX_PER_DAY) return [];
  const ready = candidates.some(c => now >= (c.manual ? c.at : Math.min(c.at + GROUP_WAIT, LATEST_NUDGE)));
  if (!ready) return [];
  return candidates.filter(c => c.at <= now).sort((a, b) => a.at - b.at);
}

// Whether the last IGNORED_LIMIT reminders about a habit all went unanswered: for each, whether it
// was logged on the day it was sent, most recent first
export function shouldMute(answered: boolean[]) {
  return answered.length >= IGNORED_LIMIT && answered.slice(0, IGNORED_LIMIT).every(a => !a);
}

export interface ReminderMessage {
  title: string;
  body: string;
  // The page a tap opens
  url: string;
}

// The body of a nudge about one habit: how far along it is, and when it's usually further along
function singleBody({ usual, progress }: Candidate, bedtime: string) {
  if (progress) {
    const soFar = `${progress.done} of ${progress.needed} so far`;
    return usual !== null ? `${soFar}. You're usually at ${progress.done + 1} by ${formatDayMinute(usual, bedtime)}.` : `${soFar} today.`;
  }
  return usual !== null ? `Not logged yet. You usually do this around ${formatDayMinute(usual, bedtime)}.` : 'Not logged yet today.';
}

// What a nudge says. One habit gets its name as the title and, when it was learned, when it's
// usually done; several are listed together, each done several times a day with how far along it is.
export function reminderMessage(habits: Candidate[], bedtime: string): ReminderMessage {
  if (habits.length === 1) {
    const [habit] = habits;
    return { title: habit.name, body: singleBody(habit, bedtime), url: `/log/${habit.habitId}` };
  }
  const listed = habits.map(h => (h.progress ? `${h.name} (${h.progress.done} of ${h.progress.needed})` : h.name));
  return { title: 'Running behind', body: listed.join(', '), url: '/' };
}

export interface ReminderStatus {
  enabled: boolean;
  remindAt: string | null;
  muted: boolean;
  // Learned for the habit's next entry today (see DayProgress)
  learned: LearnedTime;
  progress: DayProgress | null;
}

// A reminder's status for a cadence being chosen (in the cadence dialog), so what it says follows
// it: one done several times a day is judged entry by entry (see DayProgress), with today's entries
// so far kept, short of done. Anything else has no progress.
export function reminderStatusFor(status: ReminderStatus, cadence: Cadence): ReminderStatus {
  if (cadence.type !== 'daily' || cadence.timesPerDay <= 1) return status.progress ? { ...status, progress: null } : status;
  const needed = cadence.timesPerDay;
  const done = Math.min(status.progress?.done ?? 0, needed - 1);
  return status.progress?.needed === needed && status.progress.done === done ? status : { ...status, progress: { done, needed } };
}

// A habit's reminder before it exists (the New Habit page): off, with nothing learned yet, and for
// one done several times a day, none of today's entries done
export function newHabitReminderStatus(cadence: Cadence): ReminderStatus {
  return reminderStatusFor({ enabled: false, remindAt: null, muted: false, learned: { kind: 'tooFew', samples: 0, latest: null }, progress: null }, cadence);
}

// Whether a reminder will actually be sent: on, and not paused for going unanswered
export const reminderActive = (status: ReminderStatus) => status.enabled && !status.muted;

// A line on what a habit's reminder does, for its settings
export function describeReminder(status: ReminderStatus, bedtime: string) {
  const { learned, progress } = status;
  if (status.enabled && status.muted) return `Paused after ${IGNORED_LIMIT} reminders in a row went unanswered. Turn it back on to resume.`;
  if (!status.enabled) return 'No reminder. Usual time nudges you when you’re later than you usually log it; Set time nudges you at a time you pick.';

  const nudge = nudgeTime(status.remindAt, learned, bedtime);
  const time = formatDayMinute(nudge.at, bedtime);
  // A set or default time is for the whole day's entries; a learned one for the next entry
  const unlessDone = progress
    ? `If you aren't at ${progress.needed} by ${time} on a day it's due, you'll get a nudge.`
    : `If it isn't logged by ${time} on a day it's due, you'll get a nudge.`;

  if (nudge.source === 'set') return unlessDone;
  if (learned.kind === 'learned') {
    const usual = formatDayMinute(learned.usual, bedtime);
    // A habit done several times a day is judged entry by entry, so this moves on as the day goes
    return progress
      ? `You're usually at ${progress.done + 1} of ${progress.needed} by ${usual}. If you aren't by ${time}, you'll get a nudge. This moves on with each entry you log.`
      : `You usually log this around ${usual}. ${unlessDone}`;
  }
  if (learned.kind === 'tooFew') {
    const what = progress ? `reach ${progress.done + 1} of ${progress.needed}` : 'do this';
    return `${unlessDone} Once it's been logged on ${MIN_SAMPLES} days (${learned.samples} so far), it'll go by when you usually ${what} instead.`;
  }
  return `${unlessDone} Your times for this vary too much to learn a usual one.`;
}
