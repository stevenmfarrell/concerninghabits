'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Person } from '@/lib/userColors';
import { formatDuration } from '@/lib/format';
import { chartUnit, formatChartX, formatPlotted, seriesLabel, type ChartRow, type ChartShape, type PlottableField } from '@/lib/charts';

// The theme's colors (see globals.css), as CSS variables so the chart follows light and dark mode.
// Series take the chart colors in order, never cycled (a chart has at most three).
const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];
const CHART_GRID = 'var(--line-subtle)';
const CHART_TICK = { fill: 'var(--ink-muted)', fontSize: 12 };
const TOOLTIP_STYLE = { backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };
const TOOLTIP_LABEL_STYLE = { color: 'var(--ink-secondary)', fontWeight: 600, marginBottom: '4px' };
const TOOLTIP_ITEM_STYLE = { color: 'var(--ink)', fontWeight: 600 };
const CHART_STYLE = { cursor: 'pointer', WebkitTapHighlightColor: 'transparent', userSelect: 'none', outline: 'none' } as const;
const MARGIN = { top: 5, right: 10, left: -20, bottom: 5 };

// Above this many points a line drops its dots, which would crowd into a smear
const MAX_DOTS = 60;

// A chart of a habit's entries (see charts.ts): its rows drawn as lines or bars, a series each, on
// one axis, with a legend under it when there's more than one. A chart with a point per entry and one
// series colors each point by who logged it when `people` is given (a shared habit). Clicking a
// point calls `onPointClick` with the entry it shows (a period's latest).
export default function ChartView({ spec, kind, rows, fields, timeZone, people, onPointClick, heightClassName = 'h-64' }: {
  spec: ChartShape;
  kind: 'line' | 'bar';
  rows: ChartRow[];
  fields: PlottableField[];
  timeZone: string;
  people?: Record<string, Person>;
  onPointClick?: (logId: string) => void;
  heightClassName?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { period, series } = spec;
  const byEntry = period === 'entry';
  const byPerson = !!people && byEntry && series.length === 1;
  const unit = chartUnit(spec, fields);
  const labels = series.map(s => seriesLabel(s, fields, period));

  // Recharts tooltips can get stuck on mobile/touch devices. This forces a mouseleave on the chart
  // when touching outside it, which clears the tooltip.
  useEffect(() => {
    const handleTouchOutside = (e: TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        wrapperRef.current.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true }));
      }
    };
    document.addEventListener('touchstart', handleTouchOutside, { passive: true });
    return () => document.removeEventListener('touchstart', handleTouchOutside);
  }, []);

  const data = useMemo(() => rows.map(row => {
    const point: Record<string, unknown> = { x: row.x, logId: row.logId };
    row.values.forEach((value, i) => { point[`s${i}`] = value; });
    if (byPerson) {
      // Who logged the point. Bars take `fill` straight from their data point; line dots read it in
      // the custom dot below.
      const person = row.userId ? people?.[row.userId] : undefined;
      point.fill = person?.color ?? 'var(--ink-subtle)';
      point.personName = person?.name ?? 'Former member';
    }
    return point;
  }), [rows, byPerson, people]);

  // By entry, bars are one per entry, evenly spaced, so a day with several entries has several. They
  // are keyed by entry, and only each day's first bar gets a date tick.
  const entryDay = (x: number) => formatChartX(x, 'entry', timeZone, 'tick');
  const dayTicks = useMemo(
    () => byEntry ? rows.filter((row, i) => i === 0 || entryDay(row.x) !== entryDay(rows[i - 1].x)).flatMap(row => (row.logId ? [row.logId] : [])) : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, byEntry, timeZone],
  );

  const hasData = rows.some(row => row.values.some(v => v !== null));
  if (!hasData) {
    return (
      <div className={`w-full ${heightClassName} flex items-center justify-center text-ink-subtle text-sm italic`}>
        No data recorded for this chart yet.
      </div>
    );
  }

  // Totals and counts start from zero, as bars do; other lines fit their values
  const fromZero = kind === 'bar' || (!byEntry && series.every(s => s.fn === 'sum' || s.fn === 'count'));
  const yAxis = (
    <YAxis
      domain={fromZero ? [0, 'auto'] : ['auto', 'auto']}
      axisLine={false}
      tickLine={false}
      tick={CHART_TICK}
      tickFormatter={tick => (unit.format === 'duration' ? formatDuration(Number(tick)) : String(tick))}
    />
  );
  const tooltip = (
    <Tooltip
      cursor={kind === 'bar' ? { fill: 'var(--surface-muted)' } : false}
      contentStyle={TOOLTIP_STYLE}
      labelStyle={TOOLTIP_LABEL_STYLE}
      itemStyle={TOOLTIP_ITEM_STYLE}
      labelFormatter={(_label, payload) => {
        const x = (payload?.[0]?.payload as { x?: number } | undefined)?.x;
        return x === undefined ? '' : formatChartX(x, period, timeZone, 'tooltip');
      }}
      formatter={(value: unknown, name: unknown, item: unknown) => {
        const personName = (item as { payload?: { personName?: string } } | undefined)?.payload?.personName;
        return [formatPlotted(value, unit), personName ? `${name} · ${personName}` : String(name)];
      }}
    />
  );
  const grid = <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />;

  const handleChartClick = (e: unknown) => {
    // Clicks anywhere on the chart's vertical slice
    const logId = (e as { activePayload?: { payload: { logId?: string } }[] } | undefined)?.activePayload?.[0]?.payload.logId;
    if (logId) onPointClick?.(logId);
  };
  const handleMarkClick = (e: unknown) => {
    // Clicks on a bar or an active dot
    const logId = (e as { payload?: { logId?: string } } | undefined)?.payload?.logId;
    if (logId) onPointClick?.(logId);
  };

  const showDots = rows.length <= MAX_DOTS;

  return (
    <div className="space-y-3">
      <div ref={wrapperRef} className={`w-full ${heightClassName}`}>
        <ResponsiveContainer width="100%" height="100%">
          {kind === 'bar' ? (
            <BarChart data={data} margin={MARGIN} onClick={handleChartClick} style={CHART_STYLE}>
              {grid}
              <XAxis
                dataKey={byEntry ? 'logId' : 'x'}
                ticks={dayTicks}
                tickFormatter={value => {
                  const x = byEntry ? rows.find(row => row.logId === value)?.x : Number(value);
                  return x === undefined ? '' : formatChartX(x, period, timeZone, 'tick');
                }}
                interval="preserveStartEnd"
                minTickGap={12}
                axisLine={false}
                tickLine={false}
                tick={CHART_TICK}
                dy={10}
              />
              {yAxis}
              {tooltip}
              {series.map((_, i) => (
                <Bar
                  key={i}
                  dataKey={`s${i}`}
                  name={labels[i]}
                  fill={SERIES_COLORS[i]}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60 / series.length}
                  onClick={handleMarkClick}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data} margin={MARGIN} onClick={handleChartClick} style={CHART_STYLE}>
              {grid}
              {byEntry ? (
                <XAxis
                  dataKey="x"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  padding={{ left: 20, right: 20 }}
                  axisLine={false}
                  tickLine={false}
                  tick={CHART_TICK}
                  tickFormatter={tick => formatChartX(Number(tick), 'entry', timeZone, 'tick')}
                  dy={10}
                />
              ) : (
                <XAxis
                  dataKey="x"
                  tickFormatter={value => formatChartX(Number(value), period, timeZone, 'tick')}
                  interval="preserveStartEnd"
                  minTickGap={12}
                  axisLine={false}
                  tickLine={false}
                  tick={CHART_TICK}
                  dy={10}
                />
              )}
              {yAxis}
              {tooltip}
              {series.map((_, i) => {
                const color = SERIES_COLORS[i];
                return (
                  <Line
                    key={i}
                    type="monotone"
                    dataKey={`s${i}`}
                    name={labels[i]}
                    // An entry without this series' value, or a period with no entries to average, doesn't
                    // break the line; the dots show where the values are
                    connectNulls
                    // On a shared habit the line goes neutral so each point's person color stands out
                    stroke={byPerson ? 'var(--line-strong)' : color}
                    strokeWidth={3}
                    dot={byPerson
                      ? ({ cx, cy, index, payload }) => (
                          <circle key={index} cx={cx} cy={cy} r={4} fill={payload.fill} onClick={() => payload.logId && onPointClick?.(payload.logId)} />
                        )
                      : showDots ? { r: 4, fill: color, strokeWidth: 0 } : false}
                    activeDot={byPerson
                      ? ({ cx, cy, payload }) => (
                          <circle cx={cx} cy={cy} r={6} fill={payload.fill} stroke="var(--surface)" strokeWidth={2} onClick={() => payload.logId && onPointClick?.(payload.logId)} />
                        )
                      : { r: 6, fill: color, stroke: 'var(--surface)', strokeWidth: 2, onClick: handleMarkClick }}
                  />
                );
              })}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legend">
          {labels.map((label, i) => (
            <li key={i} className="flex items-center gap-1.5 text-sm text-ink-secondary">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: SERIES_COLORS[i] }} />
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
