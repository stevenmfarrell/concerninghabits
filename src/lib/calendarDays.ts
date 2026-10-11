import { addDays, civilDateFor, civilDayKey } from './timezone';
import { cadenceCovers, entriesNeeded, limitOf, skippedCovers, type Cadence, type CadenceUser } from './cadence';

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
