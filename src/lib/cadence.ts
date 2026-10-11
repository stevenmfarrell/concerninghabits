import { z } from 'zod';
import { addDays, civilDateFor, civilDayKey, daysBetween, parseCivilDayKey, type DayOwner } from './timezone';
import type { VacationRange } from './vacation';

// A habit's cadence: how often it's meant to be done. Stored as JSON in Habit.cadence. To add a
// cadence, add it to this union and say which shape it is in shapeOf below; the type checker then
// points at anything else that needs to know about it (CADENCE_TYPES, the editor's CADENCE_OPTIONS).
export const cadenceSchema = z.discriminatedUnion('type', [
  // Every day, `timesPerDay` times (1 for a plain daily habit)
  z.object({ type: z.literal('daily'), timesPerDay: z.number().int().min(1).max(100) }),
  // Again `days` days after the last entry: an entry counts for its own day and the days after it
  // until the next one is due
  z.object({ type: z.literal('everyNDays'), days: z.number().int().min(2).max(365) }),
  // On these days of the week (0 for Sunday to 6 for Saturday, in that order), once each. It isn't
  // due on the others, and an entry counts until the next of its days.
  z.object({
    type: z.literal('weekdays'),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7)
      .refine(days => days.every((day, i) => i === 0 || day > days[i - 1]), 'Days must be listed once each, Sunday first'),
  }),
  // `times` times per calendar week, by the user's week start. Left out for once, the usual case
  // (and how a weekly cadence was stored before it could be more than once).
  z.object({ type: z.literal('calendarWeek'), times: z.number().int().min(1).max(100).optional() }),
  // `times` times per calendar month, left out for once
  z.object({ type: z.literal('calendarMonth'), times: z.number().int().min(1).max(100).optional() }),
  // Logged whenever it happens, with nothing expected, so it's never done
  z.object({ type: z.literal('none') }),
  // At most `max` entries per day, calendar week, or calendar month: something to cut down on, or with
  // 0, to quit (every entry a slip). It's never due; each period kept to it counts toward its health,
  // and each that goes over against it.
  z.object({ type: z.literal('limit'), period: z.enum(['day', 'week', 'month']), max: z.number().int().min(0).max(100) }),
]);

export type Cadence = z.infer<typeof cadenceSchema>;
export type CadenceType = Cadence['type'];

export const DEFAULT_CADENCE: Cadence = { type: 'daily', timesPerDay: 1 };
export const NO_CADENCE: Cadence = { type: 'none' };

// Every cadence type, e.g. for the AI to choose from. Checked against the union below, so a new
// cadence can't be left out.
export const CADENCE_TYPES = ['daily', 'everyNDays', 'weekdays', 'calendarWeek', 'calendarMonth', 'none', 'limit'] as const;
type MissingCadenceTypes = Exclude<CadenceType, (typeof CADENCE_TYPES)[number]>;
const allCadenceTypesListed: MissingCadenceTypes extends never ? true : false = true;
void allCadenceTypesListed;

// What a rule needs to know about the user to place days in periods
export interface CadenceContext {
  weekStartsOn: string;
}

// What the status functions below need to know about the user to place entries on their days, and
// the user's vacations, on whose days everything of theirs counts as skipped (see excuses)
export interface CadenceUser extends CadenceContext, DayOwner {
  vacations?: readonly VacationRange[];
}

export type ProgressPeriod = 'daily' | 'weekly' | 'monthly';

// How far along something is toward done for now, e.g. 2 of 3 entries this week
export interface CadenceProgress {
  done: number;
  needed: number;
  period: ProgressPeriod;
}

// The days (civil dates, inclusive) an entry counts toward, e.g. its whole week for a weekly habit
interface DayRange {
  from: Date;
  to: Date;
}

// The first day of the week a civil date falls in, by the user's week start ("sunday" or "monday")
export function startOfWeek(day: Date, weekStartsOn: string) {
  return addDays(day, -(weekStartsOn === 'monday' ? (day.getUTCDay() + 6) % 7 : day.getUTCDay()));
}

const justThatDay = (day: Date): DayRange => ({ from: day, to: day });

// The calendar week (by the user's week start) or month a civil day falls in
function weekOf(day: Date, context: CadenceContext): DayRange {
  const from = startOfWeek(day, context.weekStartsOn);
  return { from, to: addDays(from, 6) };
}
const monthOf = (day: Date): DayRange => ({
  from: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1)),
  to: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)),
});

// The calendar periods entries are counted over: a day, a calendar week (by the user's week start),
// or a calendar month
export type Period = Extract<Cadence, { type: 'limit' }>['period'];
export type LimitPeriod = Period;
const PERIODS: Record<Period, {
  covers: (day: Date, context: CadenceContext) => DayRange;
  progress: ProgressPeriod;
  // For people: "Daily", "3× daily", "Skip today"
  title: string;
  adverb: string;
  current: string;
  // About how many days it is
  days: number;
}> = {
  day: { covers: day => justThatDay(day), progress: 'daily', title: 'Daily', adverb: 'daily', current: 'today', days: 1 },
  week: { covers: weekOf, progress: 'weekly', title: 'Weekly', adverb: 'weekly', current: 'this week', days: 7 },
  month: { covers: day => monthOf(day), progress: 'monthly', title: 'Monthly', adverb: 'monthly', current: 'this month', days: 30 },
};

// About how many days a period is
export const periodDays = (period: Period) => PERIODS[period].days;

// 20% of a number of days, rounded up to whole days (N / 5 rather than N * 0.2, which isn't exact in
// floating point: 15 * 0.2 rounds up to 4)
const fifthOf = (days: number) => Math.ceil(days / 5);

// A skip's labels for what it excuses, e.g. "today": "Skip today" and "Skipped today"
const skipping = (what: string) => ({ skip: `Skip ${what}`, skipped: `Skipped ${what}` });

// A skip button's label (see SkipState) once it's done, or undone: "Skip today" and "Skipped today",
// "Postpone 2 days" and "Postponed 2 days" (see skipNames), e.g. for a skip made offline before the
// server's said so
export function toggledSkipLabel(label: string) {
  return label.replace(/^(Skip|Postpone)(ped|d)? /, (_, verb: string, done?: string) => (done ? `${verb} ` : `${verb}${verb === 'Skip' ? 'ped' : 'd'} `));
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// As short as each day can be and still be told apart: one letter where that's enough, two for the
// pairs sharing a first letter (Tuesday and Thursday, Saturday and Sunday)
const WEEKDAY_ABBREVIATIONS = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'];
const WEEKDAYS = WEEKDAY_NAMES.map((name, day) => ({ day, name, abbreviation: WEEKDAY_ABBREVIATIONS[day], letter: name[0] }));

// The days of the week in the order the user's weeks run, Sunday or Monday first. Only for showing
// them: a weekday cadence stores its days by number (0 always Sunday) in Sunday-first order whatever
// the user's week start, so changing it never changes which days a habit is on.
export function weekdaysInOrder(weekStartsOn: string) {
  return weekStartsOn === 'monday' ? [...WEEKDAYS.slice(1), WEEKDAYS[0]] : WEEKDAYS;
}

// A weekday cadence's days with `day` turned on or off, in the order they're stored (see
// weekdaysInOrder). Turning off the last day leaves it on, since a cadence needs at least one.
export function toggleWeekday(days: number[], day: number) {
  const next = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
  return next.length > 0 ? next.sort((a, b) => a - b) : days;
}

// Days of the week for people, e.g. "M,W,F", "Every Tuesday", "Weekdays", in the order the user's
// weeks run
function describeWeekdays(days: number[], { weekStartsOn }: CadenceContext) {
  const key = days.join();
  if (key === '1,2,3,4,5') return 'Weekdays';
  if (key === '0,6') return 'Weekends';
  if (days.length === 7) return 'Every day';
  if (days.length === 1) return `Every ${WEEKDAY_NAMES[days[0]]}`;
  return weekdaysInOrder(weekStartsOn).filter(({ day }) => days.includes(day)).map(({ abbreviation }) => abbreviation).join(',');
}

// The first of a weekday cadence's days after civil day `day`
function nextWeekday(days: number[], day: Date) {
  for (let ahead = 1; ahead < 7; ahead++) {
    const next = addDays(day, ahead);
    if (days.includes(next.getUTCDay())) return next;
  }
  return addDays(day, 7);
}

// A weekly or monthly cadence `times` times per period, in its usual form: `times` left out for once
export function withTimes<C extends { type: 'calendarWeek' | 'calendarMonth' }>(cadence: C, times: number) {
  const { type } = cadence;
  return (times === 1 ? { type } : { type, times }) as C;
}

// How a cadence works, as one of a few shapes. Everything else (whether it's done, how a calendar
// shades a day, what a skip's called) is worked out from its shape, so a new cadence only has to say
// which it is.
// - periodic: at least `times` entries per day, calendar week, or calendar month
// - limit: at most `max` entries per day, week, or month (0 to quit: every entry a slip). It's never
//   due; each period kept to it counts toward its health, and each that goes over against it.
// - rolling: again `days` days after the last entry: an entry counts for its own day and the days
//   after it until the next one is due
// - weekdays: once on each of these days of the week (0 for Sunday); it isn't due on the others
// - none: logged whenever it happens, with nothing expected, so it's never done
export type CadenceShape =
  | { kind: 'periodic'; period: Period; times: number }
  | { kind: 'limit'; period: Period; max: number }
  | { kind: 'rolling'; days: number }
  | { kind: 'weekdays'; days: number[] }
  | { kind: 'none' };

export function shapeOf(cadence: Cadence): CadenceShape {
  switch (cadence.type) {
    case 'daily':
      return { kind: 'periodic', period: 'day', times: cadence.timesPerDay };
    case 'calendarWeek':
      return { kind: 'periodic', period: 'week', times: cadence.times ?? 1 };
    case 'calendarMonth':
      return { kind: 'periodic', period: 'month', times: cadence.times ?? 1 };
    case 'limit':
      return { kind: 'limit', period: cadence.period, max: cadence.max };
    case 'everyNDays':
      return { kind: 'rolling', days: cadence.days };
    case 'weekdays':
      return { kind: 'weekdays', days: cadence.days };
    case 'none':
      return { kind: 'none' };
    default: {
      const unhandled: never = cadence;
      return unhandled;
    }
  }
}

// For people, e.g. "3× daily", "Every 3 days", "At most 2× weekly", or for a limit of none at all,
// "Avoid", with days of the week in the order the user's weeks run
export function describeCadence(cadence: Cadence, context: CadenceContext) {
  const shape = shapeOf(cadence);
  switch (shape.kind) {
    case 'periodic':
      return shape.times === 1 ? PERIODS[shape.period].title : `${shape.times}× ${PERIODS[shape.period].adverb}`;
    case 'limit':
      if (shape.max > 0) return `At most ${shape.max}× ${PERIODS[shape.period].adverb}`;
      return shape.period === 'day' ? 'Avoid' : `Avoid ${PERIODS[shape.period].adverb}`;
    case 'rolling':
      return `Every ${shape.days} days`;
    case 'weekdays':
      return describeWeekdays(shape.days, context);
    case 'none':
      return 'No set cadence';
  }
}

// The days (inclusive) an entry made on civil day `day` counts toward: its day, week or month; for
// a rolling one, its stretch; for a weekday one, until the next of its days, so a day off after a day
// it was done reads as done too
export function cadenceCovers(cadence: Cadence, day: Date, context: CadenceContext): DayRange {
  const shape = shapeOf(cadence);
  switch (shape.kind) {
    case 'periodic':
    case 'limit':
      return PERIODS[shape.period].covers(day, context);
    case 'rolling':
      return { from: day, to: addDays(day, shape.days - 1) };
    case 'weekdays':
      return { from: day, to: addDays(nextWeekday(shape.days, day), -1) };
    case 'none':
      return justThatDay(day);
  }
}

// How many entries counting toward a day make it done; Infinity for never (a limit's entries count
// toward its limit instead, and one with no cadence is never done)
export function entriesNeeded(cadence: Cadence) {
  const shape = shapeOf(cadence);
  return shape.kind === 'periodic' ? shape.times : shape.kind === 'rolling' || shape.kind === 'weekdays' ? 1 : Infinity;
}

// The most entries a limit's period may have, or null for a cadence that isn't one
export function limitOf(cadence: Cadence) {
  const shape = shapeOf(cadence);
  return shape.kind === 'limit' ? shape.max : null;
}

// Whether its due date moves with each entry (every N days), rather than following the calendar, so
// it counts down to when it's next due, and skipping it puts it off: it's called postponing, with its
// own icon, and it's upcoming until the postponement runs out, rather than done (see CadenceStatus)
export const postpones = (cadence: Cadence) => shapeOf(cadence).kind === 'rolling';

// Whether it only needs doing by the end of its calendar week or month, so until then it isn't
// pressing yet (see onAgenda)
export function dueByPeriodEnd(cadence: Cadence) {
  const shape = shapeOf(cadence);
  return shape.kind === 'periodic' && shape.period !== 'day';
}

// Whether it's meant to be done on civil day `day` at all: only a weekday cadence's days, otherwise
// every day. On a day it isn't, it's never due, only upcoming until its next day (see statusOn).
export function isScheduled(cadence: Cadence, day: Date) {
  const shape = shapeOf(cadence);
  return shape.kind !== 'weekdays' || shape.days.includes(day.getUTCDay());
}

// How many days before it's due again a done habit counts as upcoming (0: never upcoming): the last
// 20% of a rolling stretch, but not for 3 days or fewer, where it would be upcoming nearly as soon as
// it's done
export function upcomingDays(cadence: Cadence) {
  const shape = shapeOf(cadence);
  return shape.kind === 'rolling' && shape.days > 3 ? fifthOf(shape.days) : 0;
}

// The period its entries are counted over, for showing progress through it, e.g. "2/3 weekly"; null
// for a cadence that's done with one entry, or never (a limit's progress is how much of it is used)
function progressPeriod(cadence: Cadence) {
  const shape = shapeOf(cadence);
  return shape.kind === 'periodic' && shape.times > 1 ? PERIODS[shape.period].progress : null;
}

// What a skip is called, before and after, for the button that makes one: "Skip today" and "Skipped
// today", "Skip this week", "Postpone 2 days". Null for a cadence with nothing to skip.
function skipNames(cadence: Cadence): { skip: string; skipped: string } | null {
  const shape = shapeOf(cadence);
  switch (shape.kind) {
    case 'periodic':
    case 'limit':
      // A limit's excuses its period, e.g. a planned day off from it
      return skipping(PERIODS[shape.period].current);
    case 'weekdays':
      return skipping('today');
    case 'rolling': {
      const days = fifthOf(shape.days) === 1 ? 'a day' : `${fifthOf(shape.days)} days`;
      return { skip: `Postpone ${days}`, skipped: `Postponed ${days}` };
    }
    case 'none':
      return null;
  }
}

// The days a skip made on civil day `day` excuses: what an entry that day would (see cadenceCovers),
// however many entries it takes, except for a rolling one, which it puts off for 20% of its stretch
// from that day, then it's due again, rather than starting the count over as an entry would, which
// could put it off for weeks: a day for every 5 days or fewer, 2 for every 10, 6 for every 30
function skipCovers(cadence: Cadence, day: Date, context: CadenceContext): DayRange {
  const shape = shapeOf(cadence);
  return shape.kind === 'rolling' ? { from: day, to: addDays(day, fifthOf(shape.days) - 1) } : cadenceCovers(cadence, day, context);
}

// A cadence from its stored JSON, or `fallback` if it's missing or not one we know (once a day for
// a habit; categories pass NO_CADENCE, since a category has none unless the user sets one)
export function parseCadence(raw: string | null | undefined, fallback: Cadence = DEFAULT_CADENCE): Cadence {
  try {
    const parsed = cadenceSchema.safeParse(JSON.parse(raw ?? ''));
    if (parsed.success) return parsed.data;
  } catch {
    // Not JSON: fall through to the fallback
  }
  return fallback;
}

// A cadence from a loosely shaped suggestion (e.g. the AI's, which picks a type and may leave out
// or misjudge the numbers), with defaults filled in for missing numbers. No suggestion, or one that
// doesn't fit, means no cadence: a habit only recurs when that's clearly what the user wants.
export function cadenceFromSuggestion(suggestion: { type?: string; timesPerDay?: number; days?: number; timesPerPeriod?: number; daysOfWeek?: number[]; limitPeriod?: string; max?: number } | undefined): Cadence {
  const candidate =
    suggestion?.type === 'daily' ? { type: 'daily', timesPerDay: suggestion.timesPerDay ?? 1 }
    : suggestion?.type === 'everyNDays' ? { type: 'everyNDays', days: suggestion.days ?? 2 }
    : suggestion?.type === 'weekdays' ? { type: 'weekdays', days: [...new Set(suggestion.daysOfWeek ?? [])].sort((a, b) => a - b) }
    : suggestion?.type === 'calendarWeek' || suggestion?.type === 'calendarMonth'
      ? { type: suggestion.type, ...((suggestion.timesPerPeriod ?? 1) > 1 ? { times: suggestion.timesPerPeriod } : {}) }
    : suggestion?.type === 'limit' ? { type: 'limit', period: suggestion.limitPeriod ?? 'day', max: suggestion.max ?? 0 }
    : { type: suggestion?.type };
  const parsed = cadenceSchema.safeParse(candidate);
  return parsed.success ? parsed.data : NO_CADENCE;
}

// Where a habit (or category) stands today by its cadence:
// - due: not enough entries count toward today (not logged today as often as it needs, this week
//   or month, or within its last N days), and it's meant to be done today
// - upcoming: done, but due again within its upcoming window (see upcomingDays), `dueInDays` from now;
//   or not done, but not meant to be done until its next day (a weekday habit's day off); or skipped
//   and put off until the skip runs out (an every-N-days habit)
// - done: done, and not due again for a while
// A skip counts for what an entry that day would (see skips), however many it takes, and a day it
// excuses is done, or for an every-N-days habit, upcoming: its skip puts it off.
export type CadenceStatus = { state: 'due' } | { state: 'upcoming'; dueInDays: number } | { state: 'done' };

// Something excusing a cadence, and the days it covers: a skip, made on `skippedDay` (a civil day
// key, which undoes it), or one of the user's vacations (`skippedDay` null)
interface Excuse {
  range: DayRange;
  skippedDay: string | null;
}

// What excuses a cadence up to civil day `through` (a skip or vacation day only counts once it's
// come): each skip, covering what an entry that day would, or less if skipCovers says so (see skips);
// and each of the user's vacations, covering what a skip on each of its days would, except that it
// never puts anything off past itself (every N days), so once it's over, that's due the day after:
// a vacation excuses its own days, not a grace period after them. A cadence that's never done can't
// be skipped.
function excuses(cadence: Cadence, skippedDays: readonly string[], user: CadenceUser, through: Date): Excuse[] {
  if (!skipNames(cadence)) return [];
  const throughKey = civilDayKey(through);
  const skips = skippedDays.flatMap(key => {
    const day = key <= throughKey ? parseCivilDayKey(key) : null;
    return day ? [{ skippedDay: key, range: skipCovers(cadence, day, user) }] : [];
  });
  const vacations = (user.vacations ?? []).flatMap(({ from, to }) => {
    const first = parseCivilDayKey(from);
    const last = to === null || to > throughKey ? through : parseCivilDayKey(to);
    if (!first || !last || first > last) return [];
    // The days a skip on each of its days would cover run on from one to the next, so together
    // they're those from its first day's to its last's
    const range = postpones(cadence) ? { from: first, to: last } : { from: cadenceCovers(cadence, first, user).from, to: cadenceCovers(cadence, last, user).to };
    return [{ skippedDay: null, range }];
  });
  return [...skips, ...vacations];
}

// Days from civil day `today` to the next one the cadence is meant to be done on (0 for today), for
// one that's only done on some days (see scheduled); null for one meant to be done every day
function daysToNextScheduled(cadence: Cadence, today: Date) {
  if (shapeOf(cadence).kind !== 'weekdays') return null;
  for (let ahead = 0; ahead < 7; ahead++) {
    if (isScheduled(cadence, addDays(today, ahead))) return ahead;
  }
  return null;
}

// How many days after today the period today falls in ends, for a cadence due by its end (see
// dueByPeriodEnd): 0 on its last day
function daysToPeriodEnd(cadence: Cadence, today: Date, context: CadenceContext) {
  return daysBetween(today, cadenceCovers(cadence, today, context).to);
}

// Days from civil day `today` to the day after the last of `ranges`
const dueAfter = (ranges: DayRange[], today: Date) => daysBetween(today, new Date(Math.max(...ranges.map(({ to }) => to.getTime())))) + 1;

// Where it stands on civil day `today` (see CadenceStatus), from the days the entries that count
// toward today cover (`counting`) and the days what excuses today covers (`excusing`)
function statusOn(cadence: Cadence, today: Date, counting: DayRange[], excusing: DayRange[]): CadenceStatus {
  // A limit has nothing to do, so it's never due: how it's going is its LimitStatus
  if (limitOf(cadence) !== null) return { state: 'done' };
  if (counting.length < entriesNeeded(cadence)) {
    if (excusing.length > 0) {
      // Skipped: one that counts down is put off, so it's upcoming until the skip runs out; any other
      // is done for now
      return postpones(cadence) ? { state: 'upcoming', dueInDays: dueAfter(excusing, today) } : { state: 'done' };
    }
    // Not meant to be done today: due on its next day instead
    const ahead = daysToNextScheduled(cadence, today);
    return ahead ? { state: 'upcoming', dueInDays: ahead } : { state: 'due' };
  }

  // Due again the day after the last day today's entries (or skips) count for
  const dueInDays = dueAfter([...counting, ...excusing], today);
  return dueInDays <= upcomingDays(cadence) ? { state: 'upcoming', dueInDays } : { state: 'done' };
}

// Where it goes on the Agenda: as `status`, except that one due by the end of its calendar week or
// month (see dueByPeriodEnd) isn't due until the period's last day, however many entries it still
// needs (they can all be logged on one day). Until then it's upcoming, `dueInDays` before it's due.
function onAgenda(cadence: Cadence, status: CadenceStatus, today: Date, context: CadenceContext): CadenceStatus {
  if (status.state !== 'due' || !dueByPeriodEnd(cadence)) return status;
  const dueInDays = daysToPeriodEnd(cadence, today, context);
  return dueInDays > 0 ? { state: 'upcoming', dueInDays } : status;
}

// How a limit's going in the period today falls in: `used` entries of the `max` it may have, and
// whether a skip excuses it (when going over doesn't count)
export interface LimitStatus {
  used: number;
  max: number;
  period: ProgressPeriod;
  excused: boolean;
}

// What can be done about skipping a habit now: skip it (`skippedDay` null), while it isn't done and
// is meant to be done today; or undo the skip that's excusing it, made on `skippedDay`. `label` is
// for the button, e.g. "Skip this week", "Skipped today", "Postpone 2 days", and `postpones` says
// whether it puts it off (see postpones).
export type SkipState = { label: string; skippedDay: string | null; postpones: boolean };

// Everything about where a habit (or category) stands today by its cadence (see evaluate). `kind`
// says which sort of cadence it is: one never done (`none`), one kept to at most so many entries
// (`limit`, with how much of it is used), or one done by enough entries (`target`).
export type CadenceSnapshot = {
  // Where it stands, and where that puts it on the Agenda (see CadenceStatus, onAgenda)
  status: CadenceStatus;
  agenda: CadenceStatus;
  // Whether it's only upcoming because a skip or vacation put it off (every N days), so it isn't done
  postponed: boolean;
  // How far along it is toward done for now, e.g. 3 of 4 times today, for a cadence that takes more
  // than one entry; null for one that takes a single entry (or never gets done). A skip fills it.
  progress: CadenceProgress | null;
  // How many days until it's due: for a cadence that counts down (see postpones), until it's next
  // due, positive before then, 0 on the day, negative once overdue; for one due by the end of its
  // week or month (see dueByPeriodEnd) and not done yet, until that period's last day; for one done
  // only on some days and not done for now, until the next of them (0 on one). Null for other
  // cadences, before a countdown's first entry, or once a week or month is done.
  dueInDays: number | null;
  // Skipping it, or undoing its skip (see SkipState); null when there's nothing to skip: it's done,
  // it's a day off, or its cadence has none. Only its own skips: a vacation can't be undone here.
  skip: SkipState | null;
  // Whether it's left off the Agenda for the user's vacation: one excuses it today, no skip of its
  // own does, and it isn't done anyway
  onVacation: boolean;
  // Whether it was due on the Agenda at the start of today, before any of today's entries or skips
  dueAtStartOfDay: boolean;
} & ({ kind: 'none' | 'target'; limit: null } | { kind: 'limit'; limit: LimitStatus });

// Where a habit (or category) stands today by its cadence, from its entries (`logDates`, everyone's
// that count) and the days it was skipped, as civil day keys ("2026-10-09"), with the user's
// vacations. Days follow the user's time zone and bedtime, the same as the activity calendars.
export function evaluate(cadence: Cadence, logDates: Date[], user: CadenceUser, now = new Date(), skippedDays: readonly string[] = []): CadenceSnapshot {
  const shape = shapeOf(cadence);
  const today = civilDateFor(now, user);
  const coversToday = ({ from, to }: DayRange) => from <= today && today <= to;

  const entryDays = logDates.map(date => civilDateFor(date, user));
  const entryRanges = entryDays.map(day => cadenceCovers(cadence, day, user));
  const counting = entryRanges.filter(coversToday);
  const allExcuses = excuses(cadence, skippedDays, user, today);
  const excusing = allExcuses.filter(({ range }) => coversToday(range));
  const ownExcusing = excusing.filter(({ skippedDay }) => skippedDay !== null);
  const excusingRanges = excusing.map(({ range }) => range);

  const needed = entriesNeeded(cadence);
  const period = progressPeriod(cadence);
  const met = counting.length >= needed;
  const excused = excusing.length > 0;
  const status = statusOn(cadence, today, counting, excusingRanges);
  const agenda = onAgenda(cadence, status, today, user);

  let dueInDays: number | null = null;
  if (dueByPeriodEnd(cadence) || shape.kind === 'weekdays') {
    if (!excused && !met) dueInDays = shape.kind === 'weekdays' ? daysToNextScheduled(cadence, today) : daysToPeriodEnd(cadence, today, user);
  } else if (shape.kind === 'rolling' && entryRanges.length + allExcuses.length > 0) {
    // Due the day after the last day the latest entry (or skip) counts for
    dueInDays = dueAfter([...entryRanges, ...allExcuses.map(({ range }) => range)], today);
  }

  const labels = skipNames(cadence);
  const postponing = postpones(cadence);
  const skip = !labels ? null
    : ownExcusing.length > 0 ? { label: labels.skipped, skippedDay: ownExcusing[ownExcusing.length - 1].skippedDay, postpones: postponing }
    : met || daysToNextScheduled(cadence, today) ? null
    : { label: labels.skip, skippedDay: null, postpones: postponing };

  // Before today's entries and skips: those from before today, and what excused it through yesterday
  const yesterday = addDays(today, -1);
  const countingBefore = entryRanges.filter((range, i) => entryDays[i] < today && coversToday(range));
  const excusingBefore = excuses(cadence, skippedDays, user, yesterday).map(({ range }) => range).filter(coversToday);
  const dueAtStartOfDay = onAgenda(cadence, statusOn(cadence, today, countingBefore, excusingBefore), today, user).state === 'due';

  const common = {
    status,
    agenda,
    postponed: !met && excused && postpones(cadence),
    progress: period && { done: excused ? needed : Math.min(counting.length, needed), needed, period },
    dueInDays,
    skip,
    onVacation: excusing.length > ownExcusing.length && ownExcusing.length === 0
      && onAgenda(cadence, statusOn(cadence, today, counting, []), today, user).state !== 'done',
    dueAtStartOfDay,
  };
  if (shape.kind === 'limit') {
    return { ...common, kind: 'limit', limit: { used: counting.length, max: shape.max, period: PERIODS[shape.period].progress, excused } };
  }
  return { ...common, kind: shape.kind === 'none' ? 'none' : 'target', limit: null };
}

// What a skip is called for a cadence, before and after, e.g. "Skip this week" and "Skipped this
// week", and whether it's a postponement (see postpones); null for one that can't be skipped
export function skipLabels(cadence: Cadence): { skip: string; skipped: string; postpones: boolean } | null {
  const labels = skipNames(cadence);
  return labels ? { ...labels, postpones: postpones(cadence) } : null;
}

// The days each skip and vacation covers up to today (see excuses), for an activity calendar to mark
// them
export function skippedCovers(cadence: Cadence, skippedDays: readonly string[], user: CadenceUser, now = new Date()): DayRange[] {
  return excuses(cadence, skippedDays, user, civilDateFor(now, user)).map(({ range }) => range);
}
