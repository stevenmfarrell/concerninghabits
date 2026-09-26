'use client';

interface ActivityCalendarProps {
  dates: Date[];
  weeks?: number;
  frequency?: string;
  size?: 'sm' | 'md';
  monthsPerColumn?: number;
  bedtime?: string;
  weekStartsOn?: string;
  targetCount?: number;
  onDateClick?: (date: Date) => void;
}

export default function ActivityCalendar({ dates, weeks = 5, frequency = 'daily', size = 'sm', monthsPerColumn = 4, bedtime = '00:00', weekStartsOn = 'sunday', targetCount = 3, onDateClick }: ActivityCalendarProps) {
  let bedtimeOffsetMinutes = 0;
  if (bedtime && bedtime !== '00:00') {
    const [h, m] = bedtime.split(':').map(Number);
    bedtimeOffsetMinutes = (h || 0) * 60 + (m || 0);
  }

  const today = new Date();
  if (bedtimeOffsetMinutes > 0) {
    today.setMinutes(today.getMinutes() - bedtimeOffsetMinutes);
  }
  today.setHours(0, 0, 0, 0);

  const getStartOfWeek = (d: Date) => {
    const dt = new Date(d);
    const day = dt.getDay();
    if (weekStartsOn === 'monday') {
      dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1));
    } else {
      dt.setDate(dt.getDate() - day);
    }
    return dt;
  };

  const endDate = getStartOfWeek(today);
  endDate.setDate(endDate.getDate() + 6);

  // Determine start date
  const startDate = new Date(today);
  if (weeks >= 52) {
    // For a year view, go back 11 months and snap to the 1st to ensure exactly 12 months (3 columns of 4)
    startDate.setMonth(startDate.getMonth() - 11);
    startDate.setDate(1);
  } else if (weeks > 7) {
    // Snap to 1st of the month
    startDate.setDate(today.getDate() - weeks * 7 + 1);
    startDate.setDate(1);
  } else {
    // Start date is exactly (weeks - 1) weeks prior to the start of the current week
    const alignedStart = getStartOfWeek(today);
    alignedStart.setDate(alignedStart.getDate() - (weeks - 1) * 7);
    startDate.setTime(alignedStart.getTime());
  }

  const allDays = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    allDays.push(new Date(d));
  }

  const columns: Date[][] = [];
  let currentColumn: Date[] = [];
  let currentMonths = new Set<string>();

  for (let i = 0; i < allDays.length; i++) {
    const d = allDays[i];
    const monthStr = `${d.getFullYear()}-${d.getMonth()}`;
    
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

  const completedDays = new Set<string>();
  const completedWeeks = new Set<string>();
  const completedMonths = new Set<string>();
  
  dates.forEach(d => {
    const dt = new Date(d);
    if (bedtimeOffsetMinutes > 0) {
      dt.setMinutes(dt.getMinutes() - bedtimeOffsetMinutes);
    }
    completedDays.add(`${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`);
    
    const weekStart = getStartOfWeek(dt);
    completedWeeks.add(`${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`);
    
    completedMonths.add(`${dt.getFullYear()}-${dt.getMonth()}`);
  });

  const processedColumns = columns.map(col => {
    const firstDay = col[0];
    const padStart = (firstDay.getDay() - (weekStartsOn === 'monday' ? 1 : 0) + 7) % 7;
    const padded = Array(padStart).fill(null).concat(col);
    const padEnd = (7 - (padded.length % 7)) % 7;
    const fullCol = padded.concat(Array(padEnd).fill(null));
    
    const grid = [];
    const colWeeks = fullCol.length / 7;
    
    for (let w = 0; w < colWeeks; w++) {
      for (let d = 0; d < 7; d++) {
        const day = fullCol[w * 7 + d];
        if (!day) {
          grid.push({ isNull: true, date: new Date(), count: 0, isFuture: false, isPeriodCompleted: false, isNewMonthLeft: false, isNewMonthTop: false, w, d });
          continue;
        }
        
        const isFuture = day > today;
        let count = 0;
        let isPeriodCompleted = false;
        
        if (!isFuture) {
          const dayKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const weekStart = getStartOfWeek(day);
          const weekKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
          const monthKey = `${day.getFullYear()}-${day.getMonth()}`;

          if (frequency === 'multiple') {
            count = dates.filter(dateObj => {
              const logDate = new Date(dateObj);
              return logDate.getDate() === day.getDate() &&
                     logDate.getMonth() === day.getMonth() &&
                     logDate.getFullYear() === day.getFullYear();
            }).length;
          } else {
            if (completedDays.has(dayKey)) count = 1;
          }

          if (frequency === 'weekly' && completedWeeks.has(weekKey)) isPeriodCompleted = true;
          if (frequency === 'monthly' && completedMonths.has(monthKey)) isPeriodCompleted = true;
        }
        
        const prevDay = d > 0 ? fullCol[w * 7 + d - 1] : null;
        const isNewMonthLeft = prevDay ? day.getMonth() !== prevDay.getMonth() : false;
        
        const prevWeekDay = w > 0 ? fullCol[(w - 1) * 7 + d] : null;
        const isNewMonthTop = prevWeekDay ? day.getMonth() !== prevWeekDay.getMonth() : false;

        const isToday = day.getDate() === today.getDate() && 
                        day.getMonth() === today.getMonth() && 
                        day.getFullYear() === today.getFullYear();
        
        grid.push({ isNull: false, date: day, count, isFuture, isPeriodCompleted, isNewMonthLeft, isNewMonthTop, w, d, isToday });
      }
    }
    return grid;
  });

  const getBackgroundColor = (count: number, isFuture: boolean, isPeriodCompleted: boolean) => {
    if (isFuture) return 'bg-transparent border border-stone-100';
    if (count > 0) {
      if (frequency === 'multiple') {
        const ratio = count / targetCount;
        return ratio >= 1 ? 'bg-emerald-600' :
               ratio >= 0.66 ? 'bg-emerald-500' :
               ratio >= 0.33 ? 'bg-emerald-400' :
               'bg-emerald-300';
      }
      return 'bg-emerald-500';
    }
    if (isPeriodCompleted) return 'bg-emerald-200';
    return 'bg-stone-100';
  };

  const CELL_SIZE = size === 'sm' ? 8 : 14;
  const GAP = size === 'sm' ? 3 : 4; 
  const STEP = CELL_SIZE + GAP;
  
  const cellClass = size === 'sm' ? 'w-2 h-2 rounded-[1px]' : 'w-3.5 h-3.5 rounded-[2px]';
  const gapClass = size === 'sm' ? 'gap-[3px]' : 'gap-1';

  return (
    <div className="flex justify-start gap-6">
      {processedColumns.map((grid, colIndex) => {
        const monthBlocks = [];
        let currentBlock: any = null;
        for (const cell of grid) {
          if (cell.isNull) continue;
          if (!currentBlock || currentBlock.month !== cell.date.getMonth()) {
            if (currentBlock) monthBlocks.push(currentBlock);
            const monthStr = cell.date.toLocaleString('default', { month: 'short' }).toUpperCase();
            currentBlock = {
              month: cell.date.getMonth(),
              year: cell.date.getFullYear(),
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
                  const heightPx = (block.endW - block.startW + 1) * STEP;
                  return (
                    <div key={`${block.startW}-${block.month}`}>
                      {/* Vertical Month Label */}
                      <div 
                        className="absolute w-full flex items-center justify-center overflow-visible"
                        style={{ top: topPx, height: heightPx }}
                      >
                        <div className="text-[10px] text-stone-400 font-bold tracking-widest whitespace-nowrap -rotate-90">
                          {block.text}
                        </div>
                      </div>
                      
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
                  return (
                    <div
                      key={i}
                      title={cell.isFuture ? undefined : `${cell.date.toLocaleDateString()}: ${cell.count} logs`}
                      onClick={() => {
                        if (onDateClick && !cell.isFuture) onDateClick(cell.date);
                      }}
                      className={`${cellClass} transition-colors relative z-10 flex items-center justify-center ${getBackgroundColor(cell.count, cell.isFuture, cell.isPeriodCompleted)} ${onDateClick && !cell.isFuture ? 'cursor-pointer hover:opacity-80' : ''}`}
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
