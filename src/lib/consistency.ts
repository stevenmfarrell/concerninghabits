import { cadenceCovers, dueByPeriodEnd, entriesNeeded, isScheduled, limitOf, periodDays, shapeOf, skippedCovers, type Cadence, type CadenceUser } from './cadence';
import { addDays, civilDateFor, civilDayKey, DAY_MS, daysBetween } from './timezone';

// How consistently a habit (or a category with a cadence) has been kept up lately, as a garden:
// thriving, taking root, or needing care. Not a streak: one miss dips it a little rather than
// wiping it out, it recovers as the habit's picked back up, and old history fades away.
//
// It's worked out from opportunities: each time the cadence meant it to be done (a day, a weekday
// habit's day, a week, a month, or an every-N-days habit's stretch). Each one done earns full credit,
// partly done (2 of 3 times) part of it, missed none. One that was skipped, or postponed, doesn't
// count either way. The score is the average credit, each opportunity counting half as much as one
// a half-life more recent (see halfLifeDays). One still in progress (today, this week) only counts
// once it's done, so the day isn't held against it before it's over.
//
// A limit's opportunities are its periods (days, weeks, or months): each kept to the limit earns full
// credit, and each that went over none. One still in progress counts once it's over, or as a miss as
// soon as it goes over.

// How long it takes an opportunity to count half as much, at least: three weeks, so a daily habit's
// score moves with the last few weeks, not the last few days
export const MIN_HALF_LIFE_DAYS = 21;
// ...and at least this many of its opportunities, so one with few (a monthly habit) isn't swung by
// any single one of them
const HALF_LIFE_OPPORTUNITIES = 3;
// Opportunities are looked for back over this many half-lives, after which they'd count for little,
// but no further back than this
const LOOKBACK_HALF_LIVES = 4;
const MAX_LOOKBACK_DAYS = 357;
// The trend compares the score now with this many days ago, and only counts a change this big
const TREND_DAYS = 7;
const TREND_THRESHOLD = 0.08;
// How many weeks of entries a caller needs to load for any cadence's score and its trend
export const CONSISTENCY_HISTORY_WEEKS = Math.ceil((MAX_LOOKBACK_DAYS + TREND_DAYS) / 7);
// Below this many opportunities, it's too soon to say
export const MIN_OPPORTUNITIES = 3;
// Where a score turns from needing care to taking root, and from that to thriving
export const TAKING_ROOT_FROM = 0.5;
export const THRIVING_FROM = 0.8;

export type ConsistencyLevel = 'thriving' | 'takingRoot' | 'needsCare' | 'freshlyPlanted';

export interface Consistency {
  level: ConsistencyLevel;
  // From 0 to 1; null while it's freshly planted
  score: number | null;
  // Which way it's gone over the last week, if noticeably
  trend: 'up' | 'down' | null;
}

export const CONSISTENCY_LABELS: Record<ConsistencyLevel, string> = {
  thriving: 'Thriving',
  takingRoot: 'Taking root',
  needsCare: 'Needs care',
  freshlyPlanted: 'Freshly planted',
};

const latest = (a: Date, b: Date) => (a > b ? a : b);

// How far before the start of a calendar cadence's window its first period can begin (a month's),
// with room to spare: entries before then can't count toward any of its opportunities
const PERIOD_LEAD_DAYS = 62;

// One time the cadence meant it to be done, and how much of it was: `day` is when it was settled
// (its last day, or the day it was done), which its weight is counted back from. `size` is how many
// opportunities' worth it is, for a late every-N-days entry that took more than its N days (see
// countdownOpportunities); 1 otherwise.
interface Opportunity {
  day: Date;
  credit: number;
  size?: number;
}

// The opportunities from civil day `from` to `today` for a cadence that follows the calendar (days,
// weekdays, weeks, months). `entryDays` and `skips` are civil dates and the days skips cover.
function calendarOpportunities(cadence: Cadence, entryDays: Date[], skips: { from: Date; to: Date }[], from: Date, today: Date, user: CadenceUser): Opportunity[] {
  const needed = entriesNeeded(cadence);
  const limit = limitOf(cadence);
  const settlesAtEnd = dueByPeriodEnd(cadence);

  // How many entries count toward each day, from a little before `from` (its first period can begin
  // before it) to today: each entry adds one over the days its period covers. A running total over
  // the days, rather than checking every entry against every day.
  const base = addDays(from, -PERIOD_LEAD_DAYS);
  const indexOf = (day: Date) => Math.round((day.getTime() - base.getTime()) / DAY_MS);
  const span = indexOf(today) + 1;
  const changes = new Array<number>(span + 1).fill(0);
  for (const day of entryDays) {
    const range = cadenceCovers(cadence, day, user);
    const first = Math.max(0, indexOf(range.from));
    const last = Math.min(span - 1, indexOf(range.to));
    if (first > last) continue;
    changes[first]++;
    changes[last + 1]--;
  }
  const countingOn: number[] = [];
  for (let i = 0, running = 0; i < span; i++) countingOn.push(running += changes[i]);
  const seen = new Set<string>();
  const opportunities: Opportunity[] = [];

  for (let day = from; day <= today; day = addDays(day, 1)) {
    if (!isScheduled(cadence, day)) continue;
    // The period an entry today would count toward: the day, or its week or month. A weekday
    // habit's runs on to its next day, but it's the day itself that's the opportunity.
    const period = cadenceCovers(cadence, day, user);
    const anchor = period.from;
    const key = civilDayKey(anchor);
    if (seen.has(key)) continue;
    seen.add(key);

    if (skips.some(skip => skip.from <= anchor && anchor <= skip.to)) continue;
    const count = countingOn[indexOf(anchor)] ?? 0;
    if (limit !== null) {
      // Kept only once it's over, but gone over as soon as it is. A week or month the habit didn't
      // exist for all of isn't counted: keeping to a limit for part of one says little.
      const over = count > limit;
      if (anchor < from || (!over && period.to >= today)) continue;
      opportunities.push({ day: period.to < today ? period.to : today, credit: over ? 0 : 1 });
      continue;
    }
    const credit = Math.min(count, needed) / needed;
    const settles = settlesAtEnd ? period.to : anchor;
    // Not over yet, and not done yet: it's not held against it
    if (settles >= today && credit < 1) continue;
    // A week or month the habit didn't exist for all of only counts if it was done anyway
    if (anchor < from && credit < 1) continue;
    opportunities.push({ day: settles < today ? settles : today, credit });
  }
  return opportunities;
}

// The opportunities from civil day `from` to `today` for an every-N-days cadence (N being `stretch`):
// each time it came due. Done on its due day (N days after the last time), it earns full credit. Done
// late, it's worth as many opportunities as N-day stretches it took, with the one entry's credit
// spread over them: a 3-day habit done every 4 days scores 3/4, every 6 days half. Still not done,
// each whole N days since it came due is a miss. It's due again N days after its last entry. A
// postponement just puts its due day off.
function countdownOpportunities(cadence: Cadence, stretch: number, entryDays: Date[], skips: { from: Date; to: Date }[], from: Date, today: Date, user: CadenceUser): Opportunity[] {
  const sortedEntries = [...entryDays].sort((a, b) => a.getTime() - b.getTime());
  const sortedSkips = [...skips].sort((a, b) => a.from.getTime() - b.from.getTime());
  const opportunities: Opportunity[] = [];

  // Not due at first if an entry or skip from before `from` still counts then
  let day = from;
  for (const entry of sortedEntries.filter(e => e < from)) day = latest(day, addDays(cadenceCovers(cadence, entry, user).to, 1));
  for (const skip of sortedSkips.filter(s => s.to < from)) day = latest(day, addDays(skip.to, 1));

  // `day` is when it's next due
  while (day <= today) {
    const due = day;
    const entry = sortedEntries.find(e => e >= due);
    // The first skip (or vacation) still excusing it from when it came due
    const skip = sortedSkips.find(s => s.to >= due);
    const skipFrom = skip && latest(skip.from, due);
    // Each whole stretch from when it came due to `until` that went by without it is missed
    const missStretches = (until: Date) => {
      for (let missed = 0; missed < Math.floor(daysBetween(due, until) / stretch); missed++) {
        opportunities.push({ day: addDays(due, (missed + 1) * stretch - 1), credit: 0 });
      }
    };
    if (skip && skipFrom && (!entry || skipFrom < entry)) {
      // Missed until it was postponed; the postponement itself doesn't count. Due again once it's
      // over, or on the day of an entry made during it, which counts as on time.
      missStretches(skipFrom);
      day = entry && entry <= skip.to ? entry : addDays(skip.to, 1);
      continue;
    }
    if (!entry) {
      // The stretch it's in now is still in progress
      missStretches(today);
      break;
    }
    const size = 1 + daysBetween(due, entry) / stretch;
    opportunities.push({ day: entry, credit: 1 / size, size });
    // Due again N days after its last entry, counting any made before then (done early again)
    let last = entry;
    for (const next of sortedEntries) {
      if (next > last && next <= cadenceCovers(cadence, last, user).to) last = next;
    }
    day = addDays(cadenceCovers(cadence, last, user).to, 1);
  }
  return opportunities;
}

// The score as of `now`, and how many opportunities it's from
function scoreAt(cadence: Cadence, logDates: Date[], skippedDays: readonly string[], createdAt: Date, user: CadenceUser, now: Date) {
  const civil = (date: Date) => civilDateFor(date, user);
  const today = civil(now);

  // Only what had happened by then
  const entryDays = logDates.filter(date => date <= now).map(civil);
  const skips = skippedCovers(cadence, skippedDays, user, now);

  // From when the habit began (or its first entry, if earlier, e.g. imported), but no further back
  // than opportunities count for
  const began = entryDays.reduce((earliest, day) => (day < earliest ? day : earliest), civil(createdAt));
  const from = latest(began, addDays(today, -lookbackDays(cadence)));

  // Only the entries that can still count: those in a period reaching into the window, or for an
  // every-N-days cadence, whose N days do. A year of a daily habit's entries is mostly older than
  // its window.
  const shape = shapeOf(cadence);
  const relevantFrom = addDays(from, -(PERIOD_LEAD_DAYS + (shape.kind === 'rolling' ? shape.days : 0)));
  const relevant = entryDays.filter(day => day >= relevantFrom);
  const opportunities = shape.kind === 'rolling'
    ? countdownOpportunities(cadence, shape.days, relevant, skips, from, today, user)
    : calendarOpportunities(cadence, relevant, skips, from, today, user);

  const halfLife = halfLifeDays(cadence);
  let weighted = 0;
  let total = 0;
  for (const { day, credit, size = 1 } of opportunities) {
    const weight = 0.5 ** (daysBetween(day, today) / halfLife) * size;
    weighted += weight * credit;
    total += weight;
  }
  return { score: total > 0 ? weighted / total : null, count: opportunities.length };
}

// About how many days apart a cadence's opportunities are
function spacingDays(cadence: Cadence): number {
  const shape = shapeOf(cadence);
  switch (shape.kind) {
    case 'periodic':
    case 'limit':
      return periodDays(shape.period);
    case 'rolling':
      return shape.days;
    case 'weekdays':
      return 7 / shape.days.length;
    case 'none':
      return 1;
  }
}

// How long it takes a cadence's opportunity to count half as much, and how far back they're looked for
export const halfLifeDays = (cadence: Cadence) => Math.max(MIN_HALF_LIFE_DAYS, HALF_LIFE_OPPORTUNITIES * spacingDays(cadence));
export const lookbackDays = (cadence: Cadence) => Math.min(MAX_LOOKBACK_DAYS, Math.round(LOOKBACK_HALF_LIVES * halfLifeDays(cadence)));

// How many days of entries a cadence's score and trend can need: its lookback, the week its trend
// looks back, and the periods (or every-N-days stretch) reaching into the start of that (see
// scoreAt). CONSISTENCY_HISTORY_WEEKS is the most any cadence needs.
export function healthHistoryDays(cadence: Cadence) {
  const shape = shapeOf(cadence);
  return lookbackDays(cadence) + TREND_DAYS + PERIOD_LEAD_DAYS + (shape.kind === 'rolling' ? shape.days : 0);
}

// When a category's history began, for its consistency: when it was made, or the first entry on any
// of its habits if that's earlier
export function categoryBegan(createdAt: Date, habits: readonly { began?: Date }[]) {
  return habits.reduce((earliest, habit) => (habit.began && habit.began < earliest ? habit.began : earliest), createdAt);
}

const levelFor = (score: number): ConsistencyLevel => (score >= THRIVING_FROM ? 'thriving' : score >= TAKING_ROOT_FROM ? 'takingRoot' : 'needsCare');

// How consistently a habit or category has kept to `cadence` lately, from its entries (everyone's,
// for a shared habit) and the days it was skipped, since it was created; null for one with no
// cadence, which nothing's expected of. Callers load CONSISTENCY_HISTORY_WEEKS of entries.
export function consistency(
  cadence: Cadence,
  logDates: Date[],
  user: CadenceUser,
  { createdAt, skippedDays = [] }: { createdAt: Date; skippedDays?: readonly string[] },
  now = new Date(),
): Consistency | null {
  if (cadence.type === 'none') return null;
  const current = scoreAt(cadence, logDates, skippedDays, createdAt, user, now);
  if (current.score === null || current.count < MIN_OPPORTUNITIES) return { level: 'freshlyPlanted', score: null, trend: null };

  const before = scoreAt(cadence, logDates, skippedDays, createdAt, user, new Date(now.getTime() - TREND_DAYS * DAY_MS));
  const change = before.score !== null && before.count >= MIN_OPPORTUNITIES ? current.score - before.score : 0;
  return {
    level: levelFor(current.score),
    score: current.score,
    trend: change >= TREND_THRESHOLD ? 'up' : change <= -TREND_THRESHOLD ? 'down' : null,
  };
}
