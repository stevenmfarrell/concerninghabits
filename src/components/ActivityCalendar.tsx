'use client';

import { civilDayKey, parseBedtimeOffsetMinutes, toCivilDate } from '@/lib/timezone';
import { cadenceCovers, DEFAULT_CADENCE, entriesNeeded, postpones, skippedCovers, startOfWeek, type Cadence } from '@/lib/cadence';
import { ACTIVITY_PALETTES, activityShade, type ActivityColor } from '@/lib/activityShade';
import { calendarStart } from '@/lib/calendarRange';
import type { Person } from '@/lib/userColors';

// Whether `neighbor` (a possibly-absent, possibly-padding cell) falls in a different month than
// `day`. Shared by all four month-divider checks below so they can't drift from one another.
const isDifferentMonth = (neighbor: Date | null, day: Date) =>
  !neighbor || neighbor.getUTCMonth() !== day.getUTCMonth();

interface ActivityCalendarProps {
  dates: Date[];
  // The viewer's IANA time zone. Days are bucketed in this zone, so the server render and the
  // browser render agree regardless of where each one runs.
  timeZone: string;
  weeks?: number;
  // The habit's cadence, which decides how a day is shaded: logged, partly logged toward a
  // several-times-a-day target, or covered by an entry on another day (its week, its month, or
  // within N days of it)
  cadence?: Cadence;
  // Instead of a cadence, for a calendar combining several habits (e.g. a category's): shade each
  // day by its number of entries out of this many
  density?: number;
  // xs: a list row's mini calendar, small and plain, with no month dividers or today marker
  size?: 'xs' | 'sm' | 'md';
  monthsPerColumn?: number;
  emptyColor?: string;
  futureColor?: string;
  bedtime?: string;
  weekStartsOn?: string;
  onDateClick?: (date: Date) => void;
  // For a shared habit: color each day by who logged it instead of the single emerald scale.
  // `loggedBy[i]` is the id of the user who logged `dates[i]`; `people` has each user's color.
  loggedBy?: string[];
  people?: Record<string, Person>;
  // Fill color for logged days: emerald for a habit, blue for a category's combined calendar
  color?: ActivityColor;
  // The days a habit was skipped, as civil day keys. Each marks the days it covers by the cadence
  // (its week, for a weekly habit) that aren't done by entries.
  skippedDays?: string[];
}

// A cell's fill for the people who logged that day: their color, or equal diagonal bands of each
// person's color when several did.
function personFill(ids: string[], people: Record<string, Person>) {
  const colors = ids.map(id => people[id]?.color ?? 'var(--ink-subtle)'); // for a since-deleted user
  if (colors.length === 1) return colors[0];
  const band = 100 / colors.length;
  return `linear-gradient(135deg, ${colors.map((c, i) => `${c} ${i * band}% ${(i + 1) * band}%`).join(', ')})`;
}

// All dates below are civil dates (UTC midnight for a day in `timeZone`), so only UTC methods are used.
export default function ActivityCalendar({ dates, timeZone, weeks = 5, cadence = DEFAULT_CADENCE, density, size = 'sm', monthsPerColumn = 4, bedtime = '00:00', weekStartsOn = 'sunday', emptyColor = 'bg-surface-muted', futureColor = 'bg-transparent border border-line-subtle', onDateClick, loggedBy, people, color = 'emerald', skippedDays }: ActivityCalendarProps) {
  const bedtimeOffsetMinutes = parseBedtimeOffsetMinutes(bedtime);
  const startsMonday = weekStartsOn === 'monday';
  const colorByPerson = !!(loggedBy && people);

  // A combined calendar's density works like a habit due that many times a day
  const effectiveCadence: Cadence = density ? { type: 'daily', timesPerDay: Math.max(1, density) } : cadence;
  const needed = entriesNeeded(effectiveCadence);
  // What a fully shaded logged day takes: the cadence's daily target, or one entry when it has none
  const shadeTarget = Number.isFinite(needed) ? needed : 1;

  const today = toCivilDate(new Date(), timeZone, bedtimeOffsetMinutes);

  const getStartOfWeek = (d: Date) => startOfWeek(d, weekStartsOn);

  const endDate = getStartOfWeek(today);
  endDate.setUTCDate(endDate.getUTCDate() + 6);

  // Whole months when it draws month dividers (all but a row's plain xs calendar), so its first row
  // never has a divider over only part of it
  const startDate = calendarStart(today, weeks, weekStartsOn, size !== 'xs');

  const allDays = [];
  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    allDays.push(new Date(d));
  }

  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;

  const columns: Date[][] = [];
  let currentColumn: Date[] = [];
  let currentMonths = new Set<string>();

  for (let i = 0; i < allDays.length; i++) {
    const d = allDays[i];
    const monthStr = monthKey(d);
    
    if (!currentMonths.has(monthStr)) {
      if (currentMonths.size === monthsPerColumn) {
        columns.push(currentColumn);
        currentColumn = [];
        currentMonths = new Set();
      }
      currentMonths.add(monthStr);
    }
    currentColumn.push(d);
  }
  if (currentColumn.length > 0) columns.push(currentColumn);

  // Entries on each day, and entries counting toward each day by the cadence (an entry counts for
  // its own day, and for a weekly, monthly or every-N-days habit, the rest of its week, month or N
  // days too). Only the days shown are tracked. When coloring by person, also who made them.
  const dayCounts = new Map<string, number>();
  const countingCounts = new Map<string, number>();
  const loggersOn = new Map<string, Set<string>>();
  const loggersCounting = new Map<string, Set<string>>();
  const addLogger = (loggers: Map<string, Set<string>>, key: string, userId: string) => {
    const set = loggers.get(key) ?? new Set<string>();
    set.add(userId);
    loggers.set(key, set);
  };

  dates.forEach((d, i) => {
    const day = toCivilDate(d, timeZone, bedtimeOffsetMinutes);
    const dayKey = civilDayKey(day);
    dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);
    if (colorByPerson) addLogger(loggersOn, dayKey, loggedBy![i]);

    const { from, to } = cadenceCovers(effectiveCadence, day, { weekStartsOn });
    const last = to < endDate ? to : endDate;
    for (const covered = new Date(from > startDate ? from : startDate); covered <= last; covered.setUTCDate(covered.getUTCDate() + 1)) {
      const key = civilDayKey(covered);
      countingCounts.set(key, (countingCounts.get(key) ?? 0) + 1);
      if (colorByPerson) addLogger(loggersCounting, key, loggedBy![i]);
    }
  });

  // Days excused by a skip, of those shown
  const skippedKeys = new Set<string>();
  for (const { from, to } of skippedCovers(effectiveCadence, skippedDays ?? [], { weekStartsOn })) {
    const last = to < endDate ? to : endDate;
    for (const covered = new Date(from > startDate ? from : startDate); covered <= last; covered.setUTCDate(covered.getUTCDate() + 1)) {
      skippedKeys.add(civilDayKey(covered));
    }
  }

  // Loggers in account order (the order of `people`), so a day's color bands are always arranged
  // the same way.
  const personOrder = Object.keys(people ?? {});
  const sortLoggers = (loggers: Set<string> | undefined) =>
    [...(loggers ?? [])].sort((a, b) => personOrder.indexOf(a) - personOrder.indexOf(b));

  const processedColumns = columns.map(col => {
    const firstDay = col[0];
    const padStart = (firstDay.getUTCDay() - (startsMonday ? 1 : 0) + 7) % 7;
    const padded = Array(padStart).fill(null).concat(col);
    const padEnd = (7 - (padded.length % 7)) % 7;
    const fullCol = padded.concat(Array(padEnd).fill(null));
    
    const grid = [];
    const colWeeks = fullCol.length / 7;
    // Single place that turns a (week, day-of-week) grid position into an index into `fullCol`,
    // so the four month-divider checks below don't each repeat their own `w * 7 + d` arithmetic.
    const cellAt = (w: number, d: number) => fullCol[w * 7 + d];

    for (let w = 0; w < colWeeks; w++) {
      for (let d = 0; d < 7; d++) {
        const day = cellAt(w, d);
        if (!day) {
          grid.push({ isNull: true, date: today, count: 0, counting: 0, isFuture: false, isPeriodCompleted: false, isSkipped: false, loggers: [] as string[], isNewMonthLeft: false, isNewMonthRight: false, isNewMonthTop: false, isNewMonthBottom: false, w, d });
          continue;
        }
        
        const isFuture = day > today;
        const key = civilDayKey(day);
        // Entries made that day, and entries counting toward it (including those)
        const count = isFuture ? 0 : dayCounts.get(key) ?? 0;
        const counting = isFuture ? 0 : countingCounts.get(key) ?? 0;
        // A day with no entries of its own that's done anyway, by entries elsewhere in its week,
        // month or N days
        const isPeriodCompleted = count === 0 && counting >= needed;
        // A day with no entries of its own, not done by others, that a skip excuses
        const isSkipped = count === 0 && !isPeriodCompleted && !isFuture && skippedKeys.has(key);

        // Who to color this cell for: whoever logged that day, or for a day done by entries on
        // other days, whoever made those
        let loggers: string[] = [];
        if (colorByPerson && !isFuture) {
          if (count > 0) loggers = sortLoggers(loggersOn.get(key));
          else if (isPeriodCompleted) loggers = sortLoggers(loggersCounting.get(key));
        }
        
        const isNewMonthLeft = d > 0 && isDifferentMonth(cellAt(w, d - 1), day);
        const isNewMonthRight = d < 6 && isDifferentMonth(cellAt(w, d + 1), day);

        const isNewMonthTop = (w > 0 && isDifferentMonth(cellAt(w - 1, d), day)) || (w === 0 && day.getUTCDate() <= 7);

        const daysInMonth = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
        const isNewMonthBottom = (w < colWeeks - 1 && isDifferentMonth(cellAt(w + 1, d), day)) || (w === colWeeks - 1 && day.getUTCDate() > daysInMonth - 7);

        const isToday = civilDayKey(day) === civilDayKey(today);
        
        grid.push({ isNull: false, date: day, count, counting, isFuture, isPeriodCompleted, isSkipped, loggers, isNewMonthLeft, isNewMonthRight, isNewMonthTop, isNewMonthBottom, w, d, isToday });
      }
    }
    return grid;
  });

  const getBackgroundColor = (count: number, counting: number, isFuture: boolean, isPeriodCompleted: boolean, isSkipped: boolean) => {
    if (isFuture) return futureColor;
    if (isSkipped) return `${emptyColor} activity-skipped`;
    if (count > 0) {
      if (shadeTarget > 1) return activityShade(counting, shadeTarget, color);
      return ACTIVITY_PALETTES[color].done;
    }
    if (isPeriodCompleted) return ACTIVITY_PALETTES[color].periodDone;
    return emptyColor;
  };

  // The person-colored equivalent of getBackgroundColor's emerald shades: full color for a logged
  // day (lighter while a multiple-times-a-day habit is short of its target), faint for a day in a
  // completed week or month.
  const getPersonStyle = (loggers: string[], count: number, counting: number): React.CSSProperties | undefined => {
    if (loggers.length === 0 || !people) return undefined;
    let opacity = 0.35;
    if (count > 0) {
      const ratio = counting / shadeTarget;
      opacity = ratio >= 1 ? 1 : ratio >= 0.66 ? 0.85 : ratio >= 0.33 ? 0.7 : 0.55;
    }
    return { background: personFill(loggers, people), opacity };
  };

  const CELL_SIZE = { xs: 6, sm: 8, md: 14 }[size];
  const GAP = { xs: 2, sm: 3, md: 4 }[size];
  const STEP = CELL_SIZE + GAP;

  const cellClass = { xs: 'w-1.5 h-1.5 rounded-[1px]', sm: 'w-2 h-2 rounded-[1px]', md: 'w-3.5 h-3.5 rounded-[2px]' }[size];
  const gapClass = { xs: 'gap-[2px]', sm: 'gap-[3px]', md: 'gap-1' }[size];
  // No today marker in a row's plain mini calendar (xs)
  const todayDotClass = { xs: null, sm: 'w-[4px] h-[4px]', md: 'w-[6px] h-[6px]' }[size];

  return (
    <div className="flex justify-start gap-6">
      {processedColumns.map((grid, colIndex) => {
        type MonthBlock = { month: number; year: number; startW: number; endW: number; text: string };
        const monthBlocks: MonthBlock[] = [];
        let currentBlock: MonthBlock | null = null;
        for (const cell of grid) {
          if (cell.isNull) continue;
          if (!currentBlock || currentBlock.month !== cell.date.getUTCMonth()) {
            if (currentBlock) monthBlocks.push(currentBlock);
            const monthStr = cell.date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
            currentBlock = {
              month: cell.date.getUTCMonth(),
              year: cell.date.getUTCFullYear(),
              startW: cell.w,
              endW: cell.w,
              text: monthStr
            };
          } else {
            currentBlock.endW = cell.w;
          }
        }
        if (currentBlock) monthBlocks.push(currentBlock);

        return (
          <div key={colIndex} className="flex gap-1.5 shrink-0">
            {size === 'md' && (
              <div className="relative w-6 shrink-0 mt-1">
                {monthBlocks.map(block => {
                  const topPx = block.startW * STEP;
                  const weeksCount = block.endW - block.startW + 1;
                  const heightPx = weeksCount * STEP;
                  return (
                    <div key={`${block.startW}-${block.month}`}>
                      {/* Vertical Month Label */}
                      {weeksCount >= 2 && (
                        <div 
                          className="absolute w-full flex items-center justify-center overflow-visible"
                          style={{ top: topPx, height: heightPx }}
                        >
                          <div className="text-[10px] text-ink-subtle font-bold tracking-widest whitespace-nowrap -rotate-90">
                            {block.text}
                          </div>
                        </div>
                      )}
                      
                      {/* Horizontal Year Labels */}
                      {block.month === 0 && (
                        <div 
                          className="absolute w-full text-[9px] text-ink-subtle font-bold flex justify-center"
                          style={{ top: topPx + 8 }}
                        >
                          {block.year}
                        </div>
                      )}
                      {block.month === 11 && (
                        <div 
                          className="absolute w-full text-[9px] text-ink-subtle font-bold flex justify-center"
                          style={{ top: block.endW * STEP - 8 }}
                        >
                          {block.year}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Isolated, so the cells' and month lines' z-indexes only layer them within the grid, rather
                than lifting them over a page's pinned section headings as it scrolls under them */}
            <div className="relative isolate shrink-0">
              <div className={`grid grid-cols-7 ${gapClass}`}>
                {grid.map((cell, i) => {
                  if (cell.isNull) {
                    return <div key={i} className={cellClass} />;
                  }
                  const personStyle = getPersonStyle(cell.loggers, cell.count, cell.counting);
                  const loggerNames = cell.loggers.map(id => people?.[id]?.name ?? 'Former member').join(', ');
                  return (
                    <div
                      key={i}
                      title={cell.isFuture ? undefined : `${cell.date.toLocaleDateString('en-US', { timeZone: 'UTC' })}: ${cell.isSkipped ? (postpones(effectiveCadence) ? 'postponed' : 'skipped') : `${cell.count} logs`}${loggerNames ? ` (${loggerNames})` : ''}`}
                      onClick={() => {
                        if (onDateClick && !cell.isFuture) onDateClick(cell.date);
                      }}
                      style={personStyle}
                      className={`${cellClass} transition-colors relative z-10 flex items-center justify-center ${personStyle ? '' : getBackgroundColor(cell.count, cell.counting, cell.isFuture, cell.isPeriodCompleted, cell.isSkipped)} ${onDateClick && !cell.isFuture ? 'cursor-pointer hover:opacity-80' : ''}`}
                    >
                      {cell.isToday && todayDotClass && (
                        <div className={`rounded-full ${cell.count > 0 ? 'bg-white' : 'bg-ink-muted'} ${todayDotClass}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Month Dividers, left out of a row's plain mini calendar */}
              {size !== 'xs' && <div className="absolute inset-0 z-20 pointer-events-none">
                {grid.map((cell, i) => {
                  if (cell.isNull) return null;
                  return (
                    <div key={`boundary-${i}`}>
                      {cell.isNewMonthLeft && (
                        <div 
                          className="absolute bg-ink-subtle"
                          style={{
                            left: cell.d * STEP - 2,
                            top: cell.w * STEP - 2,
                            width: 1,
                            height: STEP + 1
                          }}
                        />
                      )}
                      {cell.isNewMonthRight && (
                        <div 
                          className="absolute bg-ink-subtle"
                          style={{
                            left: (cell.d + 1) * STEP - 2,
                            top: cell.w * STEP - 2,
                            width: 1,
                            height: STEP + 1
                          }}
                        />
                      )}
                      {cell.isNewMonthTop && (
                        <div 
                          className="absolute bg-ink-subtle"
                          style={{
                            left: cell.d * STEP - 2,
                            top: cell.w * STEP - 2,
                            width: STEP + 1,
                            height: 1
                          }}
                        />
                      )}
                      {cell.isNewMonthBottom && (
                        <div 
                          className="absolute bg-ink-subtle"
                          style={{
                            left: cell.d * STEP - 2,
                            top: (cell.w + 1) * STEP - 2,
                            width: STEP + 1,
                            height: 1
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
