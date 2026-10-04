'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Person } from '@/lib/userColors';
import { BarChart2, ChevronDown, LineChart as LineChartIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatLogValue, formatDuration } from '../../../lib/format';
import type { HabitSchema } from '@/lib/types';
import { fieldTitle, type HabitFormProperties } from '@/components/widgets/habitForm';
import { PANE_INSET, PANE_SURFACE, PaneHeading } from '@/components/Pane';
import { MENU_PANEL, MenuBackdrop, menuOptionClasses } from '@/components/ui/Menu';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

// The theme's colors (see globals.css), as CSS variables so the chart follows light and dark mode
const CHART_COLOR = 'var(--accent)';
const CHART_GRID = 'var(--line-subtle)';
const CHART_TICK = { fill: 'var(--ink-muted)', fontSize: 12 };
const TOOLTIP_STYLE = { backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--line)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };
const TOOLTIP_LABEL_STYLE = { color: 'var(--ink-secondary)', fontWeight: 600, marginBottom: '4px' };
const TOOLTIP_ITEM_STYLE = { color: 'var(--accent-ink-strong)', fontWeight: 700 };

const CHART_TYPE_OPTIONS = [
  { value: 'bar' as const, label: 'Bar chart', icon: <BarChart2 className="w-4 h-4" /> },
  { value: 'line' as const, label: 'Line chart', icon: <LineChartIcon className="w-4 h-4" /> },
];

// The tooltip's label for a value: the field name, plus who logged it on a shared habit
function tooltipLabel(fieldLabel: string, item: unknown) {
  const personName = (item as { payload?: { personName?: string } } | undefined)?.payload?.personName;
  return personName ? `${fieldLabel} · ${personName}` : fieldLabel;
}

export default function HabitChart({
  logs,
  numericFields,
  pageSize,
  habitId,
  defaultSelectedField,
  defaultChartTypes,
  schemaObj,
  timeZone,
  people
}: {
  logs: { id: string, createdAt: Date, payload: string, userId: string }[],
  // Set for a shared habit, to color each point by who logged it
  people?: Record<string, Person>,
  numericFields: string[],
  pageSize: number,
  habitId: string,
  defaultSelectedField: string,
  defaultChartTypes: Record<string, 'line' | 'bar'>,
  schemaObj?: HabitSchema,
  timeZone: string
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schemaProperties = schemaObj?.properties as HabitFormProperties | undefined;
  const [selectedField, setSelectedField] = useState<string>(defaultSelectedField);
  const [chartTypes, setChartTypes] = useState<Record<string, 'line' | 'bar'>>(defaultChartTypes);
  const [isOpen, setIsOpen] = useState(false);
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  // Recharts tooltips can get stuck on mobile/touch devices.
  // This listener forces a mouseleave event on the chart when touching outside it, which clears the tooltip.
  useEffect(() => {
    const handleTouchOutside = (e: TouchEvent) => {
      if (chartWrapperRef.current && !chartWrapperRef.current.contains(e.target as Node)) {
        // Recharts listens to mouseleave on the wrapper container
        const event = new MouseEvent('mouseleave', { bubbles: true, cancelable: true });
        chartWrapperRef.current.dispatchEvent(event);
      }
    };
    document.addEventListener('touchstart', handleTouchOutside, { passive: true });
    return () => document.removeEventListener('touchstart', handleTouchOutside);
  }, []);

  const yDomain: [number | string, number | string] = chartTypes[selectedField] === 'bar' ? [0, 'auto'] : ['auto', 'auto'];

  const data = useMemo(() => {
    // Parse payloads and extract the selected field
    const points = logs.map(log => {
      const person = people?.[log.userId];
      // Who logged the point, when the chart is colored by person. Bars take `fill` straight from
      // their data point; line dots read it in the custom dot below.
      const loggedBy = people ? { fill: person?.color ?? 'var(--ink-subtle)', personName: person?.name ?? 'Former member' } : { fill: CHART_COLOR, personName: undefined };
      try {
        const payload = JSON.parse(log.payload);
        const val = payload[selectedField];
        return {
          logId: log.id,
          date: new Date(log.createdAt).getTime(), // Sort by time
          dateStr: new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone }),
          value: typeof val === 'number' ? val : null,
          ...loggedBy
        };
      } catch {
        return { logId: log.id, date: new Date(log.createdAt).getTime(), dateStr: '', value: null, ...loggedBy };
      }
    });

    // Filter out nulls and sort chronologically (oldest to newest)
    return points
      .filter(p => p.value !== null)
      .sort((a, b) => a.date - b.date);
  }, [logs, selectedField, timeZone, people]);

  // The bar chart is one bar per entry, evenly spaced, so a day with several entries has several
  // bars. Bars are keyed by entry, and only each day's first bar gets a date tick.
  const dayTicks = useMemo(
    () => data.filter((point, i) => i === 0 || point.dateStr !== data[i - 1].dateStr).map(point => point.logId),
    [data],
  );
  const tickDate = (logId: unknown) => data.find(point => point.logId === logId)?.dateStr ?? '';

  // The tooltip's heading: when the hovered entry was logged, read from the entry itself rather than
  // the axis label (a bar's label is its entry's id). With the time, so same-day entries can be told apart.
  const tooltipDate = (_label: unknown, payload: ReadonlyArray<{ payload?: { date?: number } }>) => {
    const date = payload?.[0]?.payload?.date;
    return date === undefined ? '' : new Date(date).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone });
  };

  if (numericFields.length === 0) return null;

  const hasData = data.length > 0;

  const isDuration = schemaProperties?.[selectedField]?.['x-widget'] === 'duration';

  const yAxisTickFormatter = (tick: unknown) => {
    if (isDuration) return formatDuration(Number(tick));
    return String(tick);
  };

  const handleChartClick = (e: unknown) => {
    // This catches clicks anywhere on the chart's vertical slice
    const state = e as { activePayload?: { payload: { logId: string } }[] } | undefined;
    if (state?.activePayload && state.activePayload.length > 0) {
      triggerHighlight(state.activePayload[0].payload.logId);
    }
  };

  const handleDotClick = (e: unknown) => {
    // This catches direct clicks on the active dot
    const state = e as { payload?: { logId: string } } | undefined;
    if (state?.payload?.logId) {
      triggerHighlight(state.payload.logId);
    }
  };

  const triggerHighlight = (clickedLogId: string) => {
    if (!clickedLogId) return;

    const index = logs.findIndex(l => l.id === clickedLogId);
    const page = index !== -1 ? Math.floor(index / pageSize) + 1 : 1;
    
    // We append a timestamp so that even if you click the SAME dot twice, the URL changes and the animation re-triggers
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    params.set('highlight', clickedLogId);
    params.set('t', Date.now().toString());
    
    router.replace(`/log/${habitId}?${params.toString()}`, { scroll: false });
    
    setTimeout(() => {
      const targetElement = document.getElementById(`log-${clickedLogId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  // A field's name with its unit, e.g. "Distance (miles)". A duration's "unit" is the format its
  // values are shown in, which gains an hours place once any entry reaches an hour.
  const getFieldLabel = (field: string) => {
    const label = fieldTitle(field, schemaProperties);
    if (schemaProperties?.[field]?.['x-widget'] === 'duration') {
      const hasHours = logs.some(log => {
        try {
          const val = JSON.parse(log.payload)[field];
          return typeof val === 'number' && val >= 60;
        } catch {
          return false;
        }
      });
      return `${label} (${hasHours ? 'h:mm:ss' : 'm:ss'})`;
    }
    const fieldUnit = schemaProperties?.[field]?.['x-unit'];
    return fieldUnit ? `${label} (${fieldUnit})` : label;
  };

  return (
    <section>
      <PaneHeading action={
        <>
          {numericFields.length > 1 && (
            <div className="relative">
              <Button variant="ghost" size="xs" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
                {getFieldLabel(selectedField)}
                <ChevronDown className="w-4 h-4" />
              </Button>
              {isOpen && (
                <>
                  <MenuBackdrop onClose={() => setIsOpen(false)} />
                  <div className={`${MENU_PANEL} absolute right-0 top-full mt-1 w-48 overflow-hidden`}>
                    {numericFields.map(field => (
                      <button
                        key={field}
                        onClick={() => {
                          setSelectedField(field);
                          setIsOpen(false);
                          // Save to cookie for 10 years
                          document.cookie = `chartField_${habitId}=${field}; path=/; max-age=315360000`;
                        }}
                        className={`${menuOptionClasses(selectedField === field)} px-4`}
                      >
                        {getFieldLabel(field)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {/* With only one field to chart, just its name, in place of the picker */}
          {numericFields.length === 1 && (
            <span className="text-sm font-medium text-ink-muted">{getFieldLabel(selectedField)}</span>
          )}

          <SegmentedControl
            label="Chart type"
            options={CHART_TYPE_OPTIONS}
            value={chartTypes[selectedField] ?? 'line'}
            onChange={type => {
              setChartTypes(prev => ({ ...prev, [selectedField]: type }));
              document.cookie = `chartType_${habitId}_${selectedField}=${type}; path=/; max-age=315360000`;
            }}
          />
        </>
      }>
        Trends
      </PaneHeading>

      <div className={`${PANE_SURFACE} ${PANE_INSET} py-4`}>
        <div ref={chartWrapperRef} className="w-full h-64">
          {!hasData ? (
            <div className="w-full h-full flex items-center justify-center text-ink-subtle text-sm italic">
              No data recorded for this metric yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartTypes[selectedField] === 'bar' ? (
                <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} onClick={handleChartClick} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent', userSelect: 'none', outline: 'none' }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                  <XAxis 
                    dataKey="logId" 
                    ticks={dayTicks}
                    tickFormatter={tickDate}
                    interval="preserveStartEnd"
                    minTickGap={12}
                    axisLine={false}
                    tickLine={false}
                    tick={CHART_TICK}
                    dy={10}
                  />
                  <YAxis 
                    domain={yDomain}
                    axisLine={false}
                    tickLine={false}
                    tick={CHART_TICK}
                    tickFormatter={yAxisTickFormatter}
                  />
                  <Tooltip 
                    cursor={{ fill: 'var(--surface-muted)' }}
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelFormatter={tooltipDate}
                    formatter={(value: unknown, _name: unknown, item: unknown) => [formatLogValue(value, schemaProperties?.[selectedField]), tooltipLabel(fieldTitle(selectedField, schemaProperties), item)]}
                  />
                  <Bar
                    dataKey="value"
                    name="Value"
                    fill={CHART_COLOR}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={60}
                    onClick={handleDotClick}
                  />
                </BarChart>
              ) : (
                <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} onClick={handleChartClick} style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent', userSelect: 'none', outline: 'none' }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                  <XAxis 
                    dataKey="date" 
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    padding={{ left: 20, right: 20 }}
                    axisLine={false}
                    tickLine={false}
                    tick={CHART_TICK}
                    tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone })}
                    dy={10}
                  />
                  <YAxis 
                    domain={yDomain}
                    axisLine={false}
                    tickLine={false}
                    tick={CHART_TICK}
                    tickFormatter={yAxisTickFormatter}
                  />
                  <Tooltip 
                    cursor={false}
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelFormatter={tooltipDate}
                    formatter={(value: unknown, _name: unknown, item: unknown) => [formatLogValue(value, schemaProperties?.[selectedField]), tooltipLabel(fieldTitle(selectedField, schemaProperties), item)]}
                  />
                  {/* On a shared habit the line goes neutral so each point's person color stands out */}
                  <Line
                    type="monotone"
                    dataKey="value"
                    name="Value"
                    stroke={people ? 'var(--line-strong)' : CHART_COLOR}
                    strokeWidth={3}
                    dot={people
                      ? ({ cx, cy, index, payload }) => (
                          <circle key={index} cx={cx} cy={cy} r={4} fill={payload.fill} onClick={() => triggerHighlight(payload.logId)} />
                        )
                      : { r: 4, fill: CHART_COLOR, strokeWidth: 0, onClick: handleDotClick }}
                    activeDot={people
                      ? ({ cx, cy, payload }) => (
                          <circle cx={cx} cy={cy} r={6} fill={payload.fill} stroke="var(--surface)" strokeWidth={2} onClick={() => triggerHighlight(payload.logId)} />
                        )
                      : { r: 6, fill: 'var(--accent-hover)', stroke: 'var(--surface)', strokeWidth: 2, onClick: handleDotClick }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}
