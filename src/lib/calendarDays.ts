import { addDays, civilDateFor, civilDayKey, DAY_MS } from './timezone';
import { cadenceCovers, entriesNeeded, limitOf, skippedCovers, type Cadence, type CadenceUser } from './cadence';
import { calendarSpan } from './calendarRange';

// How each day of an activity calendar stands, for ActivityCalendar to shade: the entries made on
// it, the entries counting toward it by the cadence, whether it's done by entries on other days or
// excused by a skip, how a limit's day is shaded, and who logged it. All dates are civil dates (UTC
// midnight for a day in the user's time zone).

// How a day of a limit's calendar is shaded: in a period that went over the limit, on a day with
// entries (`overLogged`) or not (`over`); `kept`, once its period's over and kept to it, if the
// habit had begun; or in the period still going, with entries (`logged`) or not (null)
export type LimitShade = 'overLogged' | 'over' | 'kept' | 'logged' | null;

export interface CalendarDay {
  isFuture: boolean;
  isToday: boolean;
  // Entries made that day, and entries counting toward it (including those): for a weekly,
  // monthly or every-N-days cadence, the rest of an entry's week, month or N days too
  count: number;
  counting: number;
  // No entries of its own, but done anyway by entries elsewhere in its week, month or N days
  isPeriodCompleted: boolean;
  // No entries of its own and not done by others, but excused by a skip or vacation
  isSkipped: boolean;
  // For a limit (see LimitShade); null for any other cadence
  limitShade: LimitShade;
  // Who to color the day for, when coloring by who logged: whoever logged that day, or for a day
  // done by entries on other days, whoever made those. In the order they first logged.
  loggers: string[];
}

function limitShadeFor(max: number, count: number, counting: number, settled: boolean, begun: boolean): LimitShade {
  if (counting > max) return count > 0 ? 'overLogged' : 'over';
  if (settled) return begun ? 'kept' : null;
  return count > 0 ? 'logged' : null;
}

// Each day from `from` to `to` (civil dates, inclusive), keyed by civil day key. `dates` are the
// entries; `loggedBy[i]`, when given, is who made `dates[i]`, to color days by person (never for a
// limit, whose shading is about keeping to it). `since` is when the habit began, for a limit: a day
// before it isn't shaded as kept (its first entry, without it).
export function calendarDays({ dates, loggedBy, cadence, user, skippedDays = [], since, from, to, now = new Date() }: {
  dates: Date[];
  loggedBy?: string[];
  cadence: Cadence;
  user: CadenceUser;
  skippedDays?: readonly string[];
  since?: Date;
  from: Date;
  to: Date;
  now?: Date;
}): Map<string, CalendarDay> {
  const limit = limitOf(cadence);
  const needed = entriesNeeded(cadence);
  const byPerson = !!loggedBy && limit === null;
  const today = civilDateFor(now, user);
  const entryDays = dates.map(date => civilDateFor(date, user));
  // For a limit, the first day it can have been kept
  const limitFrom = since ? civilDateFor(since, user) : entryDays.reduce<Date | null>((first, day) => (!first || day < first ? day : first), null);

  // Each day of `range` that's shown
  const shownDays = function* (range: { from: Date; to: Date }) {
    const last = range.to < to ? range.to : to;
    for (let day = range.from > from ? range.from : from; day <= last; day = addDays(day, 1)) yield civilDayKey(day);
  };

  const dayCounts = new Map<string, number>();
  const countingCounts = new Map<string, number>();
  const loggersOn = new Map<string, Set<string>>();
  const loggersCounting = new Map<string, Set<string>>();
  const addLogger = (loggers: Map<string, Set<string>>, key: string, userId: string) => {
    loggers.set(key, (loggers.get(key) ?? new Set<string>()).add(userId));
  };
  entryDays.forEach((day, i) => {
    const key = civilDayKey(day);
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    if (byPerson) addLogger(loggersOn, key, loggedBy[i]);
    for (const covered of shownDays(cadenceCovers(cadence, day, user))) {
      countingCounts.set(covered, (countingCounts.get(covered) ?? 0) + 1);
      if (byPerson) addLogger(loggersCounting, covered, loggedBy[i]);
    }
  });

  const skippedKeys = new Set<string>();
  for (const range of skippedCovers(cadence, skippedDays, user, now)) {
    for (const key of shownDays(range)) skippedKeys.add(key);
  }

  const days = new Map<string, CalendarDay>();
  const todayKey = civilDayKey(today);
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const key = civilDayKey(day);
    const isFuture = day > today;
    const count = isFuture ? 0 : dayCounts.get(key) ?? 0;
    const counting = isFuture ? 0 : countingCounts.get(key) ?? 0;
    const isPeriodCompleted = count === 0 && counting >= needed;
    const isSkipped = count === 0 && !isPeriodCompleted && !isFuture && skippedKeys.has(key);
    const limitShade = limit === null || isFuture ? null : limitShadeFor(limit, count, counting, cadenceCovers(cadence, day, user).to < today, !!limitFrom && day >= limitFrom);
    const loggers = !byPerson || isFuture ? [] : count > 0 ? [...(loggersOn.get(key) ?? [])] : isPeriodCompleted ? [...(loggersCounting.get(key) ?? [])] : [];
    days.set(key, { isFuture, isToday: key === todayKey, count, counting, isPeriodCompleted, isSkipped, limitShade, loggers });
  }
  return days;
}

// A day of a calendar worked out ahead (see summarizeCalendar), with only what isn't the default: a
// day with nothing on it isn't there at all. Whether it's today or in the future isn't kept, since
// the calendar knows the date.
export interface DaySummary {
  count?: number;
  counting?: number;
  periodDone?: true;
  skipped?: true;
  limitShade?: LimitShade;
  loggers?: string[];
}

// A calendar's days worked out on the server, by civil day key, so a page sends what each day shows
// rather than every entry behind it (which for a habit's health can go back a year)
export type CalendarSummary = Record<string, DaySummary>;

// The cadence a calendar shades by: a habit's own, or for one combining several habits (a
// category's with no cadence of its own), a daily target of `density` entries
export function calendarCadence(cadence: Cadence, density?: number): Cadence {
  return density ? { type: 'daily', timesPerDay: Math.max(1, density) } : cadence;
}

// The days of a calendar of `weeks` weeks as ActivityCalendar would work them out from `dates` (see
// calendarDays), for it to draw instead. `wholeMonths` is whether it draws month dividers (all but a
// row's plain xs calendar).
export function summarizeCalendar({ weeks, wholeMonths, density, now = new Date(), ...input }: Omit<Parameters<typeof calendarDays>[0], 'from' | 'to'> & {
  weeks: number;
  wholeMonths: boolean;
  density?: number;
}): CalendarSummary {
  const cadence = calendarCadence(input.cadence, density);
  const { from, to } = calendarSpan(civilDateFor(now, input.user), weeks, input.user.weekStartsOn, wholeMonths);
  // Only entries that can reach a day shown: within a period (a month at most) or an every-N-days
  // stretch of the first. A habit's entries are loaded back as far as its health needs, which for a
  // row's four weeks is mostly too old to show. Its first entry still says when a limit began.
  const reach = 62 + (cadence.type === 'everyNDays' ? cadence.days : 0);
  const earliest = addDays(from, -reach).getTime() - DAY_MS;
  const kept = input.dates.flatMap((date, i) => (date.getTime() >= earliest ? [i] : []));
  const since = input.since ?? input.dates.reduce<Date | undefined>((first, date) => (!first || date < first ? date : first), undefined);
  const summary: CalendarSummary = {};
  for (const [key, day] of calendarDays({
    ...input,
    dates: kept.map(i => input.dates[i]),
    loggedBy: input.loggedBy && kept.map(i => input.loggedBy![i]),
    since,
    cadence,
    from,
    to,
    now,
  })) {
    const kept: DaySummary = {
      ...(day.count ? { count: day.count } : {}),
      ...(day.counting ? { counting: day.counting } : {}),
      ...(day.isPeriodCompleted ? { periodDone: true as const } : {}),
      ...(day.isSkipped ? { skipped: true as const } : {}),
      ...(day.limitShade ? { limitShade: day.limitShade } : {}),
      ...(day.loggers.length > 0 ? { loggers: day.loggers } : {}),
    };
    if (Object.keys(kept).length > 0) summary[key] = kept;
  }
  return summary;
}

// A day of a summarized calendar as calendarDays would have it, `today` being the civil date today
export function summarizedDay(summary: CalendarSummary, day: Date, today: Date): CalendarDay {
  const key = civilDayKey(day);
  const kept = summary[key] ?? {};
  const isFuture = day > today;
  return {
    isFuture,
    isToday: key === civilDayKey(today),
    count: isFuture ? 0 : kept.count ?? 0,
    counting: isFuture ? 0 : kept.counting ?? 0,
    isPeriodCompleted: !!kept.periodDone,
    isSkipped: !!kept.skipped,
    limitShade: kept.limitShade ?? null,
    loggers: kept.loggers ?? [],
  };
}
