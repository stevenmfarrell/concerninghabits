'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Person } from '@/lib/userColors';
import { BarChart2, Calculator, ChevronDown, LineChart as LineChartIcon, Pencil, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { formatDuration } from '../../../lib/format';
import type { HabitSchema } from '@/lib/types';
import { formatPlotted, seriesPoints, type ChartEntry, type ChartSpec, type PlottableField } from '@/lib/charts';
import type { CalculatedField } from '@/lib/calculatedFields';
import { deleteCalculatedField, saveCalculatedField } from '@/app/actions/db';
import CalculatedFieldSheet from '@/components/CalculatedFieldSheet';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PANE_INSET, PANE_SURFACE, PaneHeading } from '@/components/Pane';
import { MENU_ITEM, MENU_PANEL, MENU_SEPARATOR, MenuBackdrop, menuOptionClasses } from '@/components/ui/Menu';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
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

// Saves which chart the habit's page shows, in a cookie for 10 years, so the server renders it next time
function rememberChart(habitId: string, chartId: string) {
  document.cookie = `chartField_${habitId}=${chartId}; path=/; max-age=315360000`;
}

// The tooltip's label for a value: the field name, plus who logged it on a shared habit
function tooltipLabel(fieldLabel: string, item: unknown) {
  const personName = (item as { payload?: { personName?: string } } | undefined)?.payload?.personName;
  return personName ? `${fieldLabel} · ${personName}` : fieldLabel;
}

// The habit's form and calculated fields, for its owner, who can add and change calculated fields
// from here
export interface ChartOwnerTools {
  schema: HabitSchema;
  calculatedFields: CalculatedField[];
}

// The habit page's Trends: one of the habit's charts (see charts.ts) at a time, picked from a menu,
// as a line or bars. Clicking a point shows its entry in the list below.
export default function HabitChart({
  logs,
  fields,
  charts,
  pageSize,
  habitId,
  defaultSelectedChart,
  defaultChartTypes,
  timeZone,
  people,
  owner,
}: {
  logs: ChartEntry[],
  // Set for a shared habit, to color each point by who logged it
  people?: Record<string, Person>,
  fields: PlottableField[],
  charts: ChartSpec[],
  pageSize: number,
  habitId: string,
  defaultSelectedChart: string | undefined,
  defaultChartTypes: Record<string, 'line' | 'bar'>,
  timeZone: string,
  owner?: ChartOwnerTools,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedChart, setSelectedChart] = useState<string | undefined>(defaultSelectedChart);
  const [chartTypes, setChartTypes] = useState<Record<string, 'line' | 'bar'>>(defaultChartTypes);
  const [isOpen, setIsOpen] = useState(false);
  // The calculated field being added (key null) or changed, by the owner
  const [editingCalculated, setEditingCalculated] = useState<{ key: string | null } | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  // A chart picked that's gone (e.g. its calculated field was removed), or one just added before
  // the page has it, falls back to the first
  const chart = charts.find(c => c.id === selectedChart) ?? charts[0];
  const chartId = chart?.id ?? '';
  const field = chart && fields.find(f => f.key === chart.series[0].field);
  const calculatedField = field?.expression !== undefined ? owner?.calculatedFields.find(f => f.key === field.key) : undefined;

  const selectChart = (id: string) => {
    setSelectedChart(id);
    rememberChart(habitId, id);
  };

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

  const yDomain: [number | string, number | string] = chartTypes[chartId] === 'bar' ? [0, 'auto'] : ['auto', 'auto'];

  // A point per entry with a value, oldest first
  const data = useMemo(() => {
    if (!field) return [];
    return seriesPoints(logs, field).map(({ entry, date, value }) => {
      const person = people?.[entry.userId];
      // Who logged the point, when the chart is colored by person. Bars take `fill` straight from
      // their data point; line dots read it in the custom dot below.
      const loggedBy = people ? { fill: person?.color ?? 'var(--ink-subtle)', personName: person?.name ?? 'Former member' } : { fill: CHART_COLOR, personName: undefined };
      return {
        logId: entry.id,
        date,
        dateStr: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone }),
        value,
        ...loggedBy
      };
    });
  }, [logs, field, timeZone, people]);

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

  if (charts.length === 0 && !owner) return null;

  const hasData = data.length > 0;

  const isDuration = field?.format === 'duration';

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
  const getFieldLabel = (plotted: PlottableField | undefined) => {
    if (!plotted) return '';
    if (plotted.format === 'duration') {
      const hasHours = seriesPoints(logs, plotted).some(point => point.value >= 60);
      return `${plotted.title} (${hasHours ? 'h:mm:ss' : 'm:ss'})`;
    }
    return plotted.unit ? `${plotted.title} (${plotted.unit})` : plotted.title;
  };
  const chartLabel = (spec: ChartSpec) => getFieldLabel(fields.find(f => f.key === spec.series[0].field));

  const tooltipFormatter = (value: unknown, _name: unknown, item: unknown) => [formatPlotted(value, field), tooltipLabel(field?.title ?? '', item)];

  const saveCalculated = async (calculated: Omit<CalculatedField, 'key'>) => {
    const key = editingCalculated?.key ?? null;
    const saved = await saveCalculatedField(habitId, key, calculated);
    toast.success(key ? 'Calculated field saved' : `${saved.title} added to Trends`);
    selectChart(saved.key);
    setEditingCalculated(null);
    router.refresh();
  };

  const removeCalculated = async (key: string) => {
    setRemoving(true);
    try {
      await deleteCalculatedField(habitId, key);
      toast.success('Calculated field removed');
      setConfirmingRemove(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setRemoving(false);
    }
  };
  // The owner picks from a menu even with one chart, since it also adds calculated fields
  const showPicker = charts.length > 1 || (!!owner && charts.length > 0);

  return (
    <section>
      <PaneHeading action={
        <>
          {calculatedField && (
            <IconButton size="sm" onClick={() => setEditingCalculated({ key: calculatedField.key })} title={`Edit ${calculatedField.title}`} aria-label={`Edit ${calculatedField.title}`}>
              <Pencil className="w-5 h-5" />
            </IconButton>
          )}
          {showPicker && (
            <div className="relative">
              <Button variant="ghost" size="xs" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
                {chart && chartLabel(chart)}
                <ChevronDown className="w-4 h-4" />
              </Button>
              {isOpen && (
                <>
                  <MenuBackdrop onClose={() => setIsOpen(false)} />
                  <div className={`${MENU_PANEL} absolute right-0 top-full mt-1 w-56 overflow-hidden`}>
                    {charts.map(spec => {
                      const calculated = fields.find(f => f.key === spec.series[0].field)?.expression !== undefined;
                      return (
                        <button
                          key={spec.id}
                          onClick={() => {
                            selectChart(spec.id);
                            setIsOpen(false);
                          }}
                          className={`${menuOptionClasses(chartId === spec.id)} px-4`}
                        >
                          <span className="flex-1 min-w-0 truncate">{chartLabel(spec)}</span>
                          {calculated && <Calculator className="w-3.5 h-3.5 shrink-0 text-ink-subtle" aria-label="Calculated" />}
                        </button>
                      );
                    })}
                    {owner && (
                      <>
                        <div className={MENU_SEPARATOR} />
                        <button
                          className={MENU_ITEM}
                          onClick={() => {
                            setIsOpen(false);
                            setEditingCalculated({ key: null });
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          New calculated field
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {/* With only one field to chart, just its name, in place of the picker */}
          {!showPicker && chart && (
            <span className="text-sm font-medium text-ink-muted">{chartLabel(chart)}</span>
          )}

          {chart && (
            <SegmentedControl
              label="Chart type"
              options={CHART_TYPE_OPTIONS}
              value={chartTypes[chartId] ?? 'line'}
              onChange={type => {
                setChartTypes(prev => ({ ...prev, [chartId]: type }));
                document.cookie = `chartType_${habitId}_${chartId}=${type}; path=/; max-age=315360000`;
              }}
            />
          )}
        </>
      }>
        Trends
      </PaneHeading>

      <div className={`${PANE_SURFACE} ${PANE_INSET} py-4`}>
        <div ref={chartWrapperRef} className="w-full h-64">
          {!chart ? (
            // Only the owner gets here: a habit with nothing to chart yet, but fields to work one out from
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center">
              <p className="text-ink-subtle text-sm">Nothing to chart yet. Work out a number from each entry&apos;s values to chart it here.</p>
              <Button variant="outline" size="sm" onClick={() => setEditingCalculated({ key: null })}>
                <Plus className="w-4 h-4" />
                New calculated field
              </Button>
            </div>
          ) : !hasData ? (
            <div className="w-full h-full flex items-center justify-center text-ink-subtle text-sm italic">
              No data recorded for this metric yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartTypes[chartId] === 'bar' ? (
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
                    formatter={tooltipFormatter}
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
                    formatter={tooltipFormatter}
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

      {owner && editingCalculated && (
        <CalculatedFieldSheet
          schema={owner.schema}
          initial={editingCalculated.key ? owner.calculatedFields.find(f => f.key === editingCalculated.key) : undefined}
          entries={logs}
          doneLabel={editingCalculated.key ? 'Save' : 'Add to Trends'}
          onDone={saveCalculated}
          onRemove={editingCalculated.key ? () => {
            setConfirmingRemove(editingCalculated.key);
            setEditingCalculated(null);
          } : undefined}
          onClose={() => setEditingCalculated(null)}
        />
      )}

      <ConfirmDialog
        isOpen={confirmingRemove !== null}
        title="Remove Calculated Field"
        message={`Remove "${owner?.calculatedFields.find(f => f.key === confirmingRemove)?.title ?? 'this field'}"? It's worked out from each entry, so nothing you've logged changes.`}
        confirmText="Remove"
        isProcessing={removing}
        onConfirm={() => confirmingRemove && removeCalculated(confirmingRemove)}
        onCancel={() => setConfirmingRemove(null)}
      />
    </section>
  );
}
