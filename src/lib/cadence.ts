import { z } from 'zod';
import { parseBedtimeOffsetMinutes, toCivilDate } from './timezone';

// A habit's cadence: how often it's meant to be done. Stored as JSON in Habit.cadence. To add a
// cadence (e.g. specific days of the week), add it to this union and give it a rule in RULES below;
// the type checker then points at anything else that needs to know about it (CADENCE_TYPES, the
// editor's CADENCE_OPTIONS).
export const cadenceSchema = z.discriminatedUnion('type', [
  // Every day, `timesPerDay` times (1 for a plain daily habit)
  z.object({ type: z.literal('daily'), timesPerDay: z.number().int().min(1).max(100) }),
  // Again `days` days after the last entry: an entry counts for its own day and the days after it
  // until the next one is due
  z.object({ type: z.literal('everyNDays'), days: z.number().int().min(2).max(365) }),
  // `times` times per calendar week, by the user's week start. Left out for once, the usual case
  // (and how a weekly cadence was stored before it could be more than once).
  z.object({ type: z.literal('calendarWeek'), times: z.number().int().min(1).max(100).optional() }),
  // `times` times per calendar month, left out for once
  z.object({ type: z.literal('calendarMonth'), times: z.number().int().min(1).max(100).optional() }),
  // Logged whenever it happens, with nothing expected, so it's never done
  z.object({ type: z.literal('none') }),
]);

export type Cadence = z.infer<typeof cadenceSchema>;
export type CadenceType = Cadence['type'];

export const DEFAULT_CADENCE: Cadence = { type: 'daily', timesPerDay: 1 };
export const NO_CADENCE: Cadence = { type: 'none' };

// Every cadence type, e.g. for the AI to choose from. Checked against the union below, so a new
// cadence can't be left out.
export const CADENCE_TYPES = ['daily', 'everyNDays', 'calendarWeek', 'calendarMonth', 'none'] as const;
type MissingCadenceTypes = Exclude<CadenceType, (typeof CADENCE_TYPES)[number]>;
const allCadenceTypesListed: MissingCadenceTypes extends never ? true : false = true;
void allCadenceTypesListed;

// What a rule needs to know about the user to place days in periods
export interface CadenceContext {
  weekStartsOn: string;
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
  // For people, e.g. "3× daily", "Every 3 days"
  describe(cadence: C): string;
  // The period its entries are counted over, for showing progress through it, e.g. "2/3 weekly";
  // null for a cadence that's done with one entry, or never
  period: ProgressPeriod | null;
  // Whether it counts down to when it's next due (e.g. "in 3 days"), since its due date moves with
  // each entry rather than following the calendar. (One due by the end of its period shows the days
  // left in it instead: see daysUntilDue.)
  countsDown: boolean;
  // The days an entry made on civil day `day` counts toward
  covers(cadence: C, day: Date, context: CadenceContext): DayRange;
  // How many entries counting toward a day make it done; Infinity for never
  needed(cadence: C): number;
  // How many days before it's due again a done habit counts as upcoming (0: never upcoming)
  upcomingDays(cadence: C): number;
  // Whether it only needs doing by the end of its period (a calendar week or month), so until then
  // it isn't pressing yet: see agendaStatus
  dueByPeriodEnd: boolean;
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
  },
  everyNDays: {
    describe: c => `Every ${c.days} days`,
    period: null,
    countsDown: true,
    covers: (c, day) => ({ from: day, to: addDays(day, c.days - 1) }),
    needed: () => 1,
    // The last 20% of the stretch, rounded up to whole days (N / 5 rather than N * 0.2, which isn't
    // exact in floating point: 15 * 0.2 rounds up to 4). Not for 3 days or fewer, where it would be
    // upcoming nearly as soon as it's done.
    upcomingDays: c => (c.days > 3 ? Math.ceil(c.days / 5) : 0),
    dueByPeriodEnd: false,
  },
  calendarWeek: {
    describe: c => timesPer(c.times, 'Weekly'),
    period: 'weekly',
    countsDown: false,
    covers: (_, day, context) => {
      const from = startOfWeek(day, context.weekStartsOn);
      return { from, to: addDays(from, 6) };
    },
    needed: c => c.times ?? 1,
    upcomingDays: () => 0,
    dueByPeriodEnd: true,
  },
  calendarMonth: {
    describe: c => timesPer(c.times, 'Monthly'),
    period: 'monthly',
    countsDown: false,
    covers: (_, day) => ({
      from: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1)),
      to: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)),
    }),
    needed: c => c.times ?? 1,
    upcomingDays: () => 0,
    dueByPeriodEnd: true,
  },
  none: {
    describe: () => 'No set cadence',
    period: null,
    countsDown: false,
    covers: (_, day) => justThatDay(day),
    needed: () => Infinity,
    upcomingDays: () => 0,
    dueByPeriodEnd: false,
  },
};

// The rule for a cadence. RULES is keyed so each rule matches its own cadence's shape; TypeScript
// can't follow that through an index by `cadence.type`, hence the cast.
function ruleFor<C extends Cadence>(cadence: C) {
  return RULES[cadence.type] as unknown as CadenceRule<C>;
}

export const describeCadence = (cadence: Cadence) => ruleFor(cadence).describe(cadence);
export const cadenceCovers = (cadence: Cadence, day: Date, context: CadenceContext) => ruleFor(cadence).covers(cadence, day, context);
export const entriesNeeded = (cadence: Cadence) => ruleFor(cadence).needed(cadence);
export const upcomingDays = (cadence: Cadence) => ruleFor(cadence).upcomingDays(cadence);

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
export function cadenceFromSuggestion(suggestion: { type?: string; timesPerDay?: number; days?: number; timesPerPeriod?: number } | undefined): Cadence {
  const candidate =
    suggestion?.type === 'daily' ? { type: 'daily', timesPerDay: suggestion.timesPerDay ?? 1 }
    : suggestion?.type === 'everyNDays' ? { type: 'everyNDays', days: suggestion.days ?? 2 }
    : suggestion?.type === 'calendarWeek' || suggestion?.type === 'calendarMonth'
      ? { type: suggestion.type, ...((suggestion.timesPerPeriod ?? 1) > 1 ? { times: suggestion.timesPerPeriod } : {}) }
    : { type: suggestion?.type };
  const parsed = cadenceSchema.safeParse(candidate);
  return parsed.success ? parsed.data : NO_CADENCE;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Where a habit (or category) stands today by its cadence:
// - due: not enough entries count toward today (not logged today as often as it needs, this week
//   or month, or within its last N days)
// - upcoming: done, but due again within its upcoming window (see upcomingDays), `dueInDays` from now
// - done: done, and not due again for a while
// Days follow the user's time zone and bedtime, the same as the activity calendars. `logDates` are
// the entries that count.
export type CadenceStatus = { state: 'due' } | { state: 'upcoming'; dueInDays: number } | { state: 'done' };

// The days each entry that counts toward today covers, and today, as civil dates
function countingToday(
  cadence: Cadence,
  logDates: Date[],
  user: { timeZone: string; bedtime: string; weekStartsOn: string },
  now: Date,
) {
  const offset = parseBedtimeOffsetMinutes(user.bedtime);
  const today = toCivilDate(now, user.timeZone, offset);
  const counting = logDates
    .map(date => cadenceCovers(cadence, toCivilDate(date, user.timeZone, offset), user))
    .filter(({ from, to }) => from <= today && today <= to);
  return { today, counting };
}

// How far along a habit is toward being done for now, e.g. 3 of 4 times today, for a cadence that
// takes more than one entry; null for one that takes a single entry (or never gets done)
export function cadenceProgress(
  cadence: Cadence,
  logDates: Date[],
  user: { timeZone: string; bedtime: string; weekStartsOn: string },
  now = new Date(),
): CadenceProgress | null {
  const { period } = ruleFor(cadence);
  const needed = entriesNeeded(cadence);
  if (!period || needed <= 1) return null;
  return { done: Math.min(countingToday(cadence, logDates, user, now).counting.length, needed), needed, period };
}

// How many days after today the period today falls in ends, for a cadence due by its end (see
// dueByPeriodEnd): 0 on its last day
function daysToPeriodEnd(cadence: Cadence, today: Date, context: CadenceContext) {
  return Math.round((cadenceCovers(cadence, today, context).to.getTime() - today.getTime()) / DAY_MS);
}

// How many days until it's due: for a cadence that counts down (see countsDown), until it's next
// due, positive before then, 0 on the day, negative once overdue; for one due by the end of its week
// or month (see dueByPeriodEnd) and not done yet, until that period's last day. Null for other
// cadences, before a countdown's first entry, or once a week or month is done.
export function daysUntilDue(
  cadence: Cadence,
  logDates: Date[],
  user: { timeZone: string; bedtime: string; weekStartsOn: string },
  now = new Date(),
): number | null {
  const rule = ruleFor(cadence);
  if (rule.dueByPeriodEnd) {
    const { today, counting } = countingToday(cadence, logDates, user, now);
    return counting.length < entriesNeeded(cadence) ? daysToPeriodEnd(cadence, today, user) : null;
  }
  if (!rule.countsDown || logDates.length === 0) return null;
  const offset = parseBedtimeOffsetMinutes(user.bedtime);
  const today = toCivilDate(now, user.timeZone, offset);
  // Due the day after the last day the latest entry counts for
  const lastCovered = Math.max(...logDates.map(date => cadenceCovers(cadence, toCivilDate(date, user.timeZone, offset), user).to.getTime()));
  return Math.round((lastCovered - today.getTime()) / DAY_MS) + 1;
}

export function cadenceStatus(
  cadence: Cadence,
  logDates: Date[],
  user: { timeZone: string; bedtime: string; weekStartsOn: string },
  now = new Date(),
): CadenceStatus {
  const { today, counting } = countingToday(cadence, logDates, user, now);
  if (counting.length < entriesNeeded(cadence)) return { state: 'due' };

  // Due again the day after the last day today's entries count for
  const lastCovered = Math.max(...counting.map(({ to }) => to.getTime()));
  const dueInDays = Math.round((lastCovered - today.getTime()) / DAY_MS) + 1;
  return dueInDays <= upcomingDays(cadence) ? { state: 'upcoming', dueInDays } : { state: 'done' };
}

// Where a habit (or category) goes on the Agenda: like cadenceStatus, except that one due by the end
// of its calendar week or month (see dueByPeriodEnd) isn't due until the period's last day, however
// many entries it still needs (they can all be logged on one day). Until then it's upcoming,
// `dueInDays` before it's due.
export function agendaStatus(
  cadence: Cadence,
  logDates: Date[],
  user: { timeZone: string; bedtime: string; weekStartsOn: string },
  now = new Date(),
): CadenceStatus {
  const status = cadenceStatus(cadence, logDates, user, now);
  if (status.state !== 'due' || !ruleFor(cadence).dueByPeriodEnd) return status;

  const { today } = countingToday(cadence, logDates, user, now);
  const dueInDays = daysToPeriodEnd(cadence, today, user);
  return dueInDays > 0 ? { state: 'upcoming', dueInDays } : status;
}

// Whether it was due on the Agenda at the start of today, before any of today's entries
export function dueAtStartOfDay(
  cadence: Cadence,
  logDates: Date[],
  user: { timeZone: string; bedtime: string; weekStartsOn: string },
  now = new Date(),
) {
  const offset = parseBedtimeOffsetMinutes(user.bedtime);
  const today = toCivilDate(now, user.timeZone, offset);
  const beforeToday = logDates.filter(date => toCivilDate(date, user.timeZone, offset) < today);
  return agendaStatus(cadence, beforeToday, user, now).state === 'due';
}

// Whether a habit is done for now (upcoming counts as done)
export function isHabitComplete(
  cadence: Cadence,
  logDates: Date[],
  user: { timeZone: string; bedtime: string; weekStartsOn: string },
  now = new Date(),
) {
  return cadenceStatus(cadence, logDates, user, now).state !== 'due';
}
