'use client';

import { civilDayKey, parseBedtimeOffsetMinutes, toCivilDate } from '@/lib/timezone';
import { DEFAULT_TARGET_COUNT } from '@/lib/constants';
import { startOfWeek } from '@/lib/habitCompletion';
import { ACTIVITY_PALETTES, activityShade, type ActivityColor } from '@/lib/activityShade';
import type { Person } from '@/lib/userColors';

// `frequency` is stored as a plain string (see Habit.frequency in schema.prisma), so these can't
// be a real enum without touching every caller — but centralizing the literals here means a typo
// only has one place to hide, instead of recurring at each comparison below.
const FREQUENCY = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', MULTIPLE: 'multiple' } as const;

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
  frequency?: string;
  size?: 'sm' | 'md';
  monthsPerColumn?: number;
  emptyColor?: string;
  futureColor?: string;
  bedtime?: string;
  weekStartsOn?: string;
  targetCount?: number;
  onDateClick?: (date: Date) => void;
  // For a shared habit: color each day by who logged it instead of the single emerald scale.
  // `loggedBy[i]` is the id of the user who logged `dates[i]`; `people` has each user's color.
  loggedBy?: string[];
  people?: Record<string, Person>;
  // Fill color for logged days: emerald for a habit, blue for a category's combined calendar
  color?: ActivityColor;
}

// A cell's fill for the people who logged that day: their color, or equal diagonal bands of each
// person's color when several did.
function personFill(ids: string[], people: Record<string, Person>) {
  const colors = ids.map(id => people[id]?.color ?? '#a8a29e'); // stone-400 for a since-deleted user
  if (colors.length === 1) return colors[0];
  const band = 100 / colors.length;
  return `linear-gradient(135deg, ${colors.map((c, i) => `${c} ${i * band}% ${(i + 1) * band}%`).join(', ')})`;
}

// All dates below are civil dates (UTC midnight for a day in `timeZone`), so only UTC methods are used.
export default function ActivityCalendar({ dates, timeZone, weeks = 5, frequency = FREQUENCY.DAILY, size = 'sm', monthsPerColumn = 4, bedtime = '00:00', weekStartsOn = 'sunday', targetCount = DEFAULT_TARGET_COUNT, emptyColor = 'bg-stone-100', futureColor = 'bg-transparent border border-stone-100', onDateClick, loggedBy, people, color = 'emerald' }: ActivityCalendarProps) {
  const bedtimeOffsetMinutes = parseBedtimeOffsetMinutes(bedtime);
  const startsMonday = weekStartsOn === 'monday';
  const colorByPerson = !!(loggedBy && people);

  const today = toCivilDate(new Date(), timeZone, bedtimeOffsetMinutes);

  const getStartOfWeek = (d: Date) => startOfWeek(d, weekStartsOn);

  const endDate = getStartOfWeek(today);
  endDate.setUTCDate(endDate.getUTCDate() + 6);

  // Determine start date
  const startDate = new Date(today);
  if (weeks >= 52) {
    // For a year view, go back 11 months and snap to the 1st to ensure exactly 12 months (3 columns of 4)
    startDate.setUTCMonth(startDate.getUTCMonth() - 11);
    startDate.setUTCDate(1);
  } else if (weeks > 7) {
    // Snap to 1st of the month
    startDate.setUTCDate(today.getUTCDate() - weeks * 7 + 1);
    startDate.setUTCDate(1);
  } else {
    // Start date is exactly (weeks - 1) weeks prior to the start of the current week
    const alignedStart = getStartOfWeek(today);
    alignedStart.setUTCDate(alignedStart.getUTCDate() - (weeks - 1) * 7);
    startDate.setTime(alignedStart.getTime());
  }

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

  // Logs per day, per week and per month. A log before bedtime counts toward the previous day.
  const dayCounts = new Map<string, number>();
  const completedWeeks = new Set<string>();
  const completedMonths = new Set<string>();
  // Who logged in each day, week, and month (only tracked when coloring by person). Keys match the
  // ones above.
  const loggersByPeriod = new Map<string, Set<string>>();
  const addLogger = (key: string, userId: string) => {
    const loggers = loggersByPeriod.get(key) ?? new Set<string>();
    loggers.add(userId);
    loggersByPeriod.set(key, loggers);
  };

  dates.forEach((d, i) => {
    const dt = toCivilDate(d, timeZone, bedtimeOffsetMinutes);
    const dayKey = civilDayKey(dt);
    const weekKey = civilDayKey(getStartOfWeek(dt));
    dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);
    completedWeeks.add(weekKey);
    completedMonths.add(monthKey(dt));
    if (colorByPerson) {
      addLogger(`day:${dayKey}`, loggedBy![i]);
      addLogger(`week:${weekKey}`, loggedBy![i]);
      addLogger(`month:${monthKey(dt)}`, loggedBy![i]);
    }
  });

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
          grid.push({ isNull: true, date: today, count: 0, isFuture: false, isPeriodCompleted: false, loggers: [] as string[], isNewMonthLeft: false, isNewMonthRight: false, isNewMonthTop: false, isNewMonthBottom: false, w, d });
          continue;
        }
        
        const isFuture = day > today;
        let count = 0;
        let isPeriodCompleted = false;
        
        if (!isFuture) {
          const dayCount = dayCounts.get(civilDayKey(day)) ?? 0;
          count = frequency === FREQUENCY.MULTIPLE ? dayCount : Math.min(dayCount, 1);

          if (frequency === FREQUENCY.WEEKLY && completedWeeks.has(civilDayKey(getStartOfWeek(day)))) isPeriodCompleted = true;
          if (frequency === FREQUENCY.MONTHLY && completedMonths.has(monthKey(day))) isPeriodCompleted = true;
        }

        // Who to color this cell for: whoever logged that day, or for a day with no entries in a
        // completed week/month, whoever completed that period.
        let loggers: string[] = [];
        if (colorByPerson && !isFuture) {
          if (count > 0) loggers = sortLoggers(loggersByPeriod.get(`day:${civilDayKey(day)}`));
          else if (isPeriodCompleted && frequency === FREQUENCY.WEEKLY) loggers = sortLoggers(loggersByPeriod.get(`week:${civilDayKey(getStartOfWeek(day))}`));
          else if (isPeriodCompleted && frequency === FREQUENCY.MONTHLY) loggers = sortLoggers(loggersByPeriod.get(`month:${monthKey(day)}`));
        }
        
        const isNewMonthLeft = d > 0 && isDifferentMonth(cellAt(w, d - 1), day);
        const isNewMonthRight = d < 6 && isDifferentMonth(cellAt(w, d + 1), day);

        const isNewMonthTop = (w > 0 && isDifferentMonth(cellAt(w - 1, d), day)) || (w === 0 && day.getUTCDate() <= 7);

        const daysInMonth = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
        const isNewMonthBottom = (w < colWeeks - 1 && isDifferentMonth(cellAt(w + 1, d), day)) || (w === colWeeks - 1 && day.getUTCDate() > daysInMonth - 7);

        const isToday = civilDayKey(day) === civilDayKey(today);
        
        grid.push({ isNull: false, date: day, count, isFuture, isPeriodCompleted, loggers, isNewMonthLeft, isNewMonthRight, isNewMonthTop, isNewMonthBottom, w, d, isToday });
      }
    }
    return grid;
  });

  const getBackgroundColor = (count: number, isFuture: boolean, isPeriodCompleted: boolean) => {
    if (isFuture) return futureColor;
    if (count > 0) {
      if (frequency === FREQUENCY.MULTIPLE) return activityShade(count, targetCount, color);
      return ACTIVITY_PALETTES[color].done;
    }
    if (isPeriodCompleted) return ACTIVITY_PALETTES[color].periodDone;
    return emptyColor;
  };

  // The person-colored equivalent of getBackgroundColor's emerald shades: full color for a logged
  // day (lighter while a multiple-times-a-day habit is short of its target), faint for a day in a
  // completed week or month.
  const getPersonStyle = (loggers: string[], count: number): React.CSSProperties | undefined => {
    if (loggers.length === 0 || !people) return undefined;
    let opacity = 0.35;
    if (count > 0) {
      const ratio = frequency === FREQUENCY.MULTIPLE ? count / targetCount : 1;
      opacity = ratio >= 1 ? 1 : ratio >= 0.66 ? 0.85 : ratio >= 0.33 ? 0.7 : 0.55;
    }
    return { background: personFill(loggers, people), opacity };
  };

  const CELL_SIZE = size === 'sm' ? 8 : 14;
  const GAP = size === 'sm' ? 3 : 4; 
  const STEP = CELL_SIZE + GAP;
  
  const cellClass = size === 'sm' ? 'w-2 h-2 rounded-[1px]' : 'w-3.5 h-3.5 rounded-[2px]';
  const gapClass = size === 'sm' ? 'gap-[3px]' : 'gap-1';

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
                          <div className="text-[10px] text-stone-400 font-bold tracking-widest whitespace-nowrap -rotate-90">
                            {block.text}
                          </div>
                        </div>
                      )}
                      
                      {/* Horizontal Year Labels */}
                      {block.month === 0 && (
                        <div 
                          className="absolute w-full text-[9px] text-stone-400 font-bold flex justify-center"
                          style={{ top: topPx + 8 }}
                        >
                          {block.year}
                        </div>
                      )}
                      {block.month === 11 && (
                        <div 
                          className="absolute w-full text-[9px] text-stone-400 font-bold flex justify-center"
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
            <div className="relative shrink-0">
              <div className={`grid grid-cols-7 ${gapClass}`}>
                {grid.map((cell, i) => {
                  if (cell.isNull) {
                    return <div key={i} className={cellClass} />;
                  }
                  const personStyle = getPersonStyle(cell.loggers, cell.count);
                  const loggerNames = cell.loggers.map(id => people?.[id]?.name ?? 'Former member').join(', ');
                  return (
                    <div
                      key={i}
                      title={cell.isFuture ? undefined : `${cell.date.toLocaleDateString('en-US', { timeZone: 'UTC' })}: ${cell.count} logs${loggerNames ? ` (${loggerNames})` : ''}`}
                      onClick={() => {
                        if (onDateClick && !cell.isFuture) onDateClick(cell.date);
                      }}
                      style={personStyle}
                      className={`${cellClass} transition-colors relative z-10 flex items-center justify-center ${personStyle ? '' : getBackgroundColor(cell.count, cell.isFuture, cell.isPeriodCompleted)} ${onDateClick && !cell.isFuture ? 'cursor-pointer hover:opacity-80' : ''}`}
                    >
                      {cell.isToday && (
                        <div className={`rounded-full ${cell.count > 0 ? 'bg-white' : 'bg-stone-500'} ${size === 'sm' ? 'w-[4px] h-[4px]' : 'w-[6px] h-[6px]'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Month Dividers */}
              <div className="absolute inset-0 z-20 pointer-events-none">
                {grid.map((cell, i) => {
                  if (cell.isNull) return null;
                  return (
                    <div key={`boundary-${i}`}>
                      {cell.isNewMonthLeft && (
                        <div 
                          className="absolute bg-stone-400"
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
                          className="absolute bg-stone-400"
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
                          className="absolute bg-stone-400"
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
                          className="absolute bg-stone-400"
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
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
