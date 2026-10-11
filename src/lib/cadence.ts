import { z } from 'zod';
import { civilDayKey, parseBedtimeOffsetMinutes, parseCivilDayKey, toCivilDate } from './timezone';
import type { VacationRange } from './vacation';

// A habit's cadence: how often it's meant to be done. Stored as JSON in Habit.cadence. To add a
// cadence, add it to this union and give it a rule in RULES below;
// the type checker then points at anything else that needs to know about it (CADENCE_TYPES, the
// editor's CADENCE_OPTIONS).
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
export interface CadenceUser extends CadenceContext {
  timeZone: string;
  bedtime: string;
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

// How a cadence works. Everything else (whether a habit is done, how a calendar shades a day)
// is worked out from these, so a new cadence only has to answer them.
interface CadenceRule<C extends Cadence> {
  // For people, e.g. "3× daily", "Every 3 days", with days of the week in the order the user's
  // weeks run
  describe(cadence: C, context: CadenceContext): string;
  // The period its entries are counted over, for showing progress through it, e.g. "2/3 weekly";
  // null for a cadence that's done with one entry, or never
  period: ProgressPeriod | null;
  // Whether it counts down to when it's next due (e.g. "in 3 days"), since its due date moves with
  // each entry rather than following the calendar. (One due by the end of its period shows the days
  // left in it instead: see dueInDays in CadenceSnapshot.)
  countsDown: boolean;
  // The days an entry made on civil day `day` counts toward
  covers(cadence: C, day: Date, context: CadenceContext): DayRange;
  // For a limit (see LIMIT), the most entries its period may have; its entries count toward that
  // rather than toward being done, so it's never due
  limit?(cadence: C): number;
  // How many entries counting toward a day make it done; Infinity for never
  needed(cadence: C): number;
  // How many days before it's due again a done habit counts as upcoming (0: never upcoming)
  upcomingDays(cadence: C): number;
  // Whether it only needs doing by the end of its period (a calendar week or month), so until then
  // it isn't pressing yet: see onAgenda
  dueByPeriodEnd: boolean;
  // Whether it's meant to be done on civil day `day` at all; every day when left out. On a day it
  // isn't, it's never due, only upcoming until its next day (see statusOn).
  scheduled?(cadence: C, day: Date): boolean;
  // What a skip is called, before and after, for the button that makes one: "Skip today" and
  // "Skipped today", "Skip this week", "Postpone 2 days". A skip counts like an entry made that day
  // would (see covers), however many entries it takes, unless skipCovers says otherwise. Null for a
  // cadence with nothing to skip.
  skips(cadence: C): { skip: string; skipped: string } | null;
  // The days a skip made on civil day `day` excuses, when that's less than an entry would cover
  skipCovers?(cadence: C, day: Date): DayRange;
}

function addDays(day: Date, days: number) {
  const shifted = new Date(day);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
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

export type LimitPeriod = Extract<Cadence, { type: 'limit' }>['period'];
const LIMIT_PERIODS: Record<LimitPeriod, { progress: ProgressPeriod; covers: (day: Date, context: CadenceContext) => DayRange; adverb: string; skip: string }> = {
  day: { progress: 'daily', covers: day => justThatDay(day), adverb: 'daily', skip: 'today' },
  week: { progress: 'weekly', covers: weekOf, adverb: 'weekly', skip: 'this week' },
  month: { progress: 'monthly', covers: day => monthOf(day), adverb: 'monthly', skip: 'this month' },
};

// 20% of a number of days, rounded up to whole days (N / 5 rather than N * 0.2, which isn't exact in
// floating point: 15 * 0.2 rounds up to 4)
const fifthOf = (days: number) => Math.ceil(days / 5);

// A skip's labels for what it excuses, e.g. "today": "Skip today" and "Skipped today"
const skipping = (what: string) => ({ skip: `Skip ${what}`, skipped: `Skipped ${what}` });

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

// A weekly or monthly cadence for people, e.g. "Weekly", "3× weekly"
const timesPer = (times: number | undefined, period: 'Weekly' | 'Monthly') => ((times ?? 1) === 1 ? period : `${times}× ${period.toLowerCase()}`);

// A weekly or monthly cadence `times` times per period, in its usual form: `times` left out for once
export function withTimes<C extends { type: 'calendarWeek' | 'calendarMonth' }>(cadence: C, times: number) {
  const { type } = cadence;
  return (times === 1 ? { type } : { type, times }) as C;
}

const RULES: { [T in CadenceType]: CadenceRule<Extract<Cadence, { type: T }>> } = {
  daily: {
    describe: c => (c.timesPerDay === 1 ? 'Daily' : `${c.timesPerDay}× daily`),
    period: 'daily',
    countsDown: false,
    covers: (_, day) => justThatDay(day),
    needed: c => c.timesPerDay,
    upcomingDays: () => 0,
    dueByPeriodEnd: false,
    skips: () => skipping('today'),
  },
  everyNDays: {
    describe: c => `Every ${c.days} days`,
    period: null,
    countsDown: true,
    covers: (c, day) => ({ from: day, to: addDays(day, c.days - 1) }),
    needed: () => 1,
    // The last 20% of the stretch. Not for 3 days or fewer, where it would be upcoming nearly as soon
    // as it's done.
    upcomingDays: c => (c.days > 3 ? fifthOf(c.days) : 0),
    dueByPeriodEnd: false,
    // For 20% of the stretch from the day it's made, then it's due again, rather than starting the
    // count over as an entry would, which could put it off for weeks: a day for every 5 days or
    // fewer, 2 for every 10, 6 for every 30. Since it puts off when it's due, it's called postponing.
    skips: c => {
      const days = fifthOf(c.days) === 1 ? 'a day' : `${fifthOf(c.days)} days`;
      return { skip: `Postpone ${days}`, skipped: `Postponed ${days}` };
    },
    skipCovers: (c, day) => ({ from: day, to: addDays(day, fifthOf(c.days) - 1) }),
  },
  weekdays: {
    describe: (c, context) => describeWeekdays(c.days, context),
    period: null,
    countsDown: false,
    // Until the next of its days, so a day off after a day it was done reads as done too
    covers: (c, day) => ({ from: day, to: addDays(nextWeekday(c.days, day), -1) }),
    needed: () => 1,
    upcomingDays: () => 0,
    dueByPeriodEnd: false,
    scheduled: (c, day) => c.days.includes(day.getUTCDay()),
    skips: () => skipping('today'),
  },
  calendarWeek: {
    describe: c => timesPer(c.times, 'Weekly'),
    period: 'weekly',
    countsDown: false,
    covers: (_, day, context) => weekOf(day, context),
    needed: c => c.times ?? 1,
    upcomingDays: () => 0,
    dueByPeriodEnd: true,
    skips: () => skipping('this week'),
  },
  calendarMonth: {
    describe: c => timesPer(c.times, 'Monthly'),
    period: 'monthly',
    countsDown: false,
    covers: (_, day) => monthOf(day),
    needed: c => c.times ?? 1,
    upcomingDays: () => 0,
    dueByPeriodEnd: true,
    skips: () => skipping('this month'),
  },
  none: {
    describe: () => 'No set cadence',
    period: null,
    countsDown: false,
    covers: (_, day) => justThatDay(day),
    needed: () => Infinity,
    upcomingDays: () => 0,
    dueByPeriodEnd: false,
    skips: () => null,
  },
  limit: {
    // e.g. "At most 2× daily", or for none at all, "Avoid" ("Avoid weekly" for a week at a time)
    describe: c => (c.max === 0
      ? (c.period === 'day' ? 'Avoid' : `Avoid ${LIMIT_PERIODS[c.period].adverb}`)
      : `At most ${c.max}× ${LIMIT_PERIODS[c.period].adverb}`),
    // Its progress is how much of the limit's used (see LimitStatus), not toward done
    period: null,
    countsDown: false,
    covers: (c, day, context) => LIMIT_PERIODS[c.period].covers(day, context),
    limit: c => c.max,
    // Never done by entries, nor due (see statusOn)
    needed: () => Infinity,
    upcomingDays: () => 0,
    dueByPeriodEnd: false,
    // Excuses its period, e.g. a planned day off from it
    skips: c => skipping(LIMIT_PERIODS[c.period].skip),
  },
};

// The rule for a cadence. RULES is keyed so each rule matches its own cadence's shape; TypeScript
// can't follow that through an index by `cadence.type`, hence the cast.
function ruleFor<C extends Cadence>(cadence: C) {
  return RULES[cadence.type] as unknown as CadenceRule<C>;
}

export const describeCadence = (cadence: Cadence, context: CadenceContext) => ruleFor(cadence).describe(cadence, context);
// Whether it's meant to be done on civil day `day` at all (see scheduled): only a weekday cadence's
// days, otherwise every day
export const isScheduled = (cadence: Cadence, day: Date) => ruleFor(cadence).scheduled?.(cadence, day) ?? true;
// Whether it counts down to when it's next due (every N days), rather than following the calendar
export const countsDown = (cadence: Cadence) => ruleFor(cadence).countsDown;
// Whether it only needs doing by the end of its week or month (see dueByPeriodEnd)
export const dueByPeriodEnd = (cadence: Cadence) => ruleFor(cadence).dueByPeriodEnd;
export const cadenceCovers = (cadence: Cadence, day: Date, context: CadenceContext) => ruleFor(cadence).covers(cadence, day, context);
export const entriesNeeded = (cadence: Cadence) => ruleFor(cadence).needed(cadence);
export const upcomingDays = (cadence: Cadence) => ruleFor(cadence).upcomingDays(cadence);
// The most entries a limit's period may have (see limit), or null for a cadence that isn't one
export const limitOf = (cadence: Cadence) => ruleFor(cadence).limit?.(cadence) ?? null;

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

const DAY_MS = 24 * 60 * 60 * 1000;

const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

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
  const rule = ruleFor(cadence);
  if (!rule.skips(cadence)) return [];
  const throughKey = civilDayKey(through);
  const skips = skippedDays.flatMap(key => {
    const day = key <= throughKey ? parseCivilDayKey(key) : null;
    return day ? [{ skippedDay: key, range: rule.skipCovers?.(cadence, day) ?? cadenceCovers(cadence, day, user) }] : [];
  });
  const vacations = (user.vacations ?? []).flatMap(({ from, to }) => {
    const first = parseCivilDayKey(from);
    const last = to === null || to > throughKey ? through : parseCivilDayKey(to);
    if (!first || !last || first > last) return [];
    // The days a skip on each of its days would cover run on from one to the next, so together
    // they're those from its first day's to its last's
    const range = rule.skipCovers ? { from: first, to: last } : { from: cadenceCovers(cadence, first, user).from, to: cadenceCovers(cadence, last, user).to };
    return [{ skippedDay: null, range }];
  });
  return [...skips, ...vacations];
}

// Days from civil day `today` to the next one the cadence is meant to be done on (0 for today), for
// one that's only done on some days (see scheduled); null for one meant to be done every day
function daysToNextScheduled(cadence: Cadence, today: Date) {
  const { scheduled } = ruleFor(cadence);
  if (!scheduled) return null;
  for (let ahead = 0; ahead < 7; ahead++) {
    if (scheduled(cadence, addDays(today, ahead))) return ahead;
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
// for the button, e.g. "Skip this week", "Skipped today", "Postpone 2 days".
export type SkipState = { label: string; skippedDay: string | null };

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
  // How many days until it's due: for a cadence that counts down (see countsDown), until it's next
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
  const rule = ruleFor(cadence);
  const offset = parseBedtimeOffsetMinutes(user.bedtime);
  const today = toCivilDate(now, user.timeZone, offset);
  const coversToday = ({ from, to }: DayRange) => from <= today && today <= to;

  const entryDays = logDates.map(date => toCivilDate(date, user.timeZone, offset));
  const entryRanges = entryDays.map(day => cadenceCovers(cadence, day, user));
  const counting = entryRanges.filter(coversToday);
  const allExcuses = excuses(cadence, skippedDays, user, today);
  const excusing = allExcuses.filter(({ range }) => coversToday(range));
  const ownExcusing = excusing.filter(({ skippedDay }) => skippedDay !== null);
  const excusingRanges = excusing.map(({ range }) => range);

  const needed = rule.needed(cadence);
  const met = counting.length >= needed;
  const excused = excusing.length > 0;
  const status = statusOn(cadence, today, counting, excusingRanges);
  const agenda = onAgenda(cadence, status, today, user);

  let dueInDays: number | null = null;
  if (rule.dueByPeriodEnd || rule.scheduled) {
    if (!excused && !met) dueInDays = rule.dueByPeriodEnd ? daysToPeriodEnd(cadence, today, user) : daysToNextScheduled(cadence, today);
  } else if (rule.countsDown && entryRanges.length + allExcuses.length > 0) {
    // Due the day after the last day the latest entry (or skip) counts for
    dueInDays = dueAfter([...entryRanges, ...allExcuses.map(({ range }) => range)], today);
  }

  const labels = rule.skips(cadence);
  const skip = !labels ? null
    : ownExcusing.length > 0 ? { label: labels.skipped, skippedDay: ownExcusing[ownExcusing.length - 1].skippedDay }
    : met || daysToNextScheduled(cadence, today) ? null
    : { label: labels.skip, skippedDay: null };

  // Before today's entries and skips: those from before today, and what excused it through yesterday
  const yesterday = addDays(today, -1);
  const countingBefore = entryRanges.filter((range, i) => entryDays[i] < today && coversToday(range));
  const excusingBefore = excuses(cadence, skippedDays, user, yesterday).map(({ range }) => range).filter(coversToday);
  const dueAtStartOfDay = onAgenda(cadence, statusOn(cadence, today, countingBefore, excusingBefore), today, user).state === 'due';

  const common = {
    status,
    agenda,
    postponed: !met && excused && postpones(cadence),
    progress: rule.period && needed > 1 ? { done: excused ? needed : Math.min(counting.length, needed), needed, period: rule.period } : null,
    dueInDays,
    skip,
    onVacation: excusing.length > ownExcusing.length && ownExcusing.length === 0
      && onAgenda(cadence, statusOn(cadence, today, counting, []), today, user).state !== 'done',
    dueAtStartOfDay,
  };
  if (cadence.type === 'limit') {
    return { ...common, kind: 'limit', limit: { used: counting.length, max: cadence.max, period: LIMIT_PERIODS[cadence.period].progress, excused } };
  }
  return { ...common, kind: needed === Infinity ? 'none' : 'target', limit: null };
}

// What a skip is called for a cadence, before and after, e.g. "Skip this week" and "Skipped this
// week", and whether it's a postponement (see postpones); null for one that can't be skipped
export function skipLabels(cadence: Cadence): { skip: string; skipped: string; postpones: boolean } | null {
  const labels = ruleFor(cadence).skips(cadence);
  return labels ? { ...labels, postpones: postpones(cadence) } : null;
}

// Whether skipping it puts it off rather than excusing it, so it's called postponing, with its own
// icon: one that counts down to when it's due (every N days) is upcoming until its skip runs out,
// rather than done (see CadenceStatus)
export const postpones = (cadence: Cadence) => countsDown(cadence);

// The days each skip and vacation covers up to today (see excuses), for an activity calendar to mark
// them
export function skippedCovers(cadence: Cadence, skippedDays: readonly string[], user: CadenceUser, now = new Date()): DayRange[] {
  const today = toCivilDate(now, user.timeZone, parseBedtimeOffsetMinutes(user.bedtime));
  return excuses(cadence, skippedDays, user, today).map(({ range }) => range);
}
