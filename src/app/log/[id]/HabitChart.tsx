'use client';

import { useState } from 'react';
import type { Person } from '@/lib/userColors';
import { BarChart2, Calculator, ChevronDown, LineChart as LineChartIcon, Pencil, Plus } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { HabitSchema } from '@/lib/types';
import { chartProblem, chartRows, drawnAsDots, periodChoiceId, periodChoices, seriesPoints, type ChartContext, type ChartEntry, type ChartSpec, type PlottableField } from '@/lib/charts';
import type { CalculatedField } from '@/lib/calculatedFields';
import { deleteCalculatedField, deleteChart, saveCalculatedField, saveChart } from '@/app/actions/charts';
import type { ChartDraft } from '@/app/actions/habit';
import CalculatedFieldSheet from '@/components/CalculatedFieldSheet';
import ChartSheet from '@/components/ChartSheet';
import ChartView from '@/components/ChartView';
import ConfirmDialog from '@/components/ConfirmDialog';
import { PANE_INSET, PANE_SURFACE, PaneHeading } from '@/components/Pane';
import { MENU_ITEM, MENU_PANEL, MENU_SEPARATOR, MenuBackdrop, menuOptionClasses } from '@/components/ui/Menu';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

const CHART_TYPE_OPTIONS = [
  { value: 'bar' as const, label: 'Bar chart', icon: <BarChart2 className="w-4 h-4" /> },
  { value: 'line' as const, label: 'Line chart', icon: <LineChartIcon className="w-4 h-4" /> },
];

// Saves which chart the habit's page shows, in a cookie for 10 years, so the server renders it next time
function rememberChart(habitId: string, chartId: string) {
  document.cookie = `chartField_${habitId}=${chartId}; path=/; max-age=315360000`;
}

function rememberChartType(habitId: string, chartId: string, type: 'line' | 'bar') {
  document.cookie = `chartType_${habitId}_${chartId}=${type}; path=/; max-age=315360000`;
}

// The period a viewer switched a custom chart to (see periodChoices); null forgets it, so the chart
// is shown by its own period again
function rememberChartPeriod(habitId: string, chartId: string, choice: string | null) {
  document.cookie = `chartPeriod_${habitId}_${chartId}=${choice ?? ''}; path=/; max-age=${choice ? 315360000 : 0}`;
}

// The habit's form and calculated fields, for its owner, who can add and change charts and
// calculated fields from here
export interface ChartOwnerTools {
  schema: HabitSchema;
  calculatedFields: CalculatedField[];
}

// What's being changed in a sheet: a custom chart (id null for a new one), or a calculated field
type Editing = { kind: 'chart'; id: string | null } | { kind: 'calculated'; key: string };
type Removing = { kind: 'chart' | 'calculated'; id: string; title: string };

// The habit page's Trends: one of the habit's charts (see charts.ts) at a time, picked from a menu:
// the owner's custom charts, then a chart per number and calculated field. Each is drawn as lines or
// bars, a choice kept per viewer. Clicking a point shows its entry in the list below.
//
// `entries` are all the habit's loaded entries, which charts rolled up by period count from
// (including before the chart's first day); the first `listedCount` of them (newest first) are the
// ones the entries list pages through.
export default function HabitChart({
  entries,
  listedCount,
  fields,
  charts,
  context,
  pageSize,
  habitId,
  defaultSelectedChart,
  defaultChartTypes,
  defaultChartPeriods,
  people,
  owner,
}: {
  entries: ChartEntry[],
  listedCount: number,
  // Set for a shared habit, to color each point by who logged it
  people?: Record<string, Person>,
  fields: PlottableField[],
  charts: ChartSpec[],
  context: ChartContext,
  pageSize: number,
  habitId: string,
  defaultSelectedChart: string | undefined,
  defaultChartTypes: Record<string, 'line' | 'bar'>,
  // The period each custom chart was last switched to by this viewer, by choice id (see periodChoices)
  defaultChartPeriods: Record<string, string>,
  owner?: ChartOwnerTools,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedChart, setSelectedChart] = useState<string | undefined>(defaultSelectedChart);
  const [chartTypes, setChartTypes] = useState<Record<string, 'line' | 'bar'>>(defaultChartTypes);
  const [chartPeriods, setChartPeriods] = useState<Record<string, string>>(defaultChartPeriods);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState<Removing | null>(null);
  const [removing, setRemoving] = useState(false);

  // A chart picked that's gone (e.g. it was removed), or one just added before the page has it,
  // falls back to the first
  const chart = charts.find(c => c.id === selectedChart) ?? charts[0];
  const chartId = chart?.id ?? '';
  const kind = chartTypes[chartId] ?? chart?.kind ?? 'line';
  // A custom chart can be switched to another period; it's drawn by the one picked, if it still can be
  const choices = chart?.custom ? periodChoices(chart) : [];
  const choice = choices.find(c => c.id === chartPeriods[chartId]) ?? choices.find(c => c.id === periodChoiceId(chart!.period));
  const shown = chart && choice ? { ...chart, period: choice.period } : chart;
  const problem = shown ? chartProblem(shown, fields) : null;
  // The calculated field a field's own chart is of, which the owner can change from here
  const calculatedField = chart && !chart.custom ? owner?.calculatedFields.find(f => f.key === chart.series[0].field) : undefined;

  const rows = shown && !problem ? chartRows(shown, fields, entries, context) : [];

  const selectChart = (id: string) => {
    setSelectedChart(id);
    rememberChart(habitId, id);
  };

  if (charts.length === 0 && !owner) return null;

  const showEntry = (logId: string) => {
    const index = entries.findIndex(l => l.id === logId);
    // A period's latest entry can be from before the entries listed below
    if (index === -1 || index >= listedCount) return;
    const page = Math.floor(index / pageSize) + 1;

    // A timestamp, so that clicking the same point twice still changes the URL and replays the highlight
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    params.set('highlight', logId);
    params.set('t', Date.now().toString());
    router.replace(`/log/${habitId}?${params.toString()}`, { scroll: false });

    setTimeout(() => {
      document.getElementById(`log-${logId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  // A field's name with its unit, e.g. "Distance (miles)". A duration's "unit" is the format its
  // values are shown in, which gains an hours place once any entry reaches an hour.
  const getFieldLabel = (plotted: PlottableField | undefined) => {
    if (!plotted) return '';
    if (plotted.format === 'duration') {
      const hasHours = seriesPoints(entries, plotted).some(point => point.value >= 60);
      return `${plotted.title} (${hasHours ? 'h:mm:ss' : 'm:ss'})`;
    }
    return plotted.unit ? `${plotted.title} (${plotted.unit})` : plotted.title;
  };
  const chartLabel = (spec: ChartSpec) => (spec.custom ? spec.title : getFieldLabel(fields.find(f => f.key === spec.series[0].field)));

  const customCharts = charts.filter((c): c is Extract<ChartSpec, { custom: true }> => c.custom);
  const fieldCharts = charts.filter(c => !c.custom);
  const editingChart = editing?.kind === 'chart' && editing.id ? customCharts.find(c => c.id === editing.id) : undefined;

  const saveEditedChart = async (draft: ChartDraft, newCalculatedFields: CalculatedField[]) => {
    const id = editing?.kind === 'chart' ? editing.id : null;
    const result = await saveChart(habitId, { ...draft, id }, newCalculatedFields);
    // A kind chosen in the sheet replaces one picked for the chart from the Trends heading
    // So do its period: the chart starts on the one it was saved with
    rememberChartType(habitId, result.showId, draft.kind);
    setChartTypes(prev => ({ ...prev, [result.showId]: draft.kind }));
    rememberChartPeriod(habitId, result.showId, null);
    setChartPeriods(prev => {
      const next = { ...prev };
      delete next[result.showId];
      return next;
    });
    toast.success(id ? 'Chart saved' : result.chart ? `${result.chart.title} added to Trends` : `${draft.title} added to Trends`);
    selectChart(result.showId);
    setEditing(null);
    router.refresh();
  };

  const saveCalculated = async (calculated: Omit<CalculatedField, 'key'>) => {
    const key = editing?.kind === 'calculated' ? editing.key : null;
    const saved = await saveCalculatedField(habitId, key, calculated);
    toast.success('Calculated field saved');
    selectChart(saved.key);
    setEditing(null);
    router.refresh();
  };

  const remove = async (target: Removing) => {
    setRemoving(true);
    try {
      if (target.kind === 'chart') await deleteChart(habitId, target.id);
      else await deleteCalculatedField(habitId, target.id);
      toast.success(target.kind === 'chart' ? 'Chart removed' : 'Calculated field removed');
      setConfirmingRemove(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setRemoving(false);
    }
  };

  // Custom charts that would lose a line along with a calculated field
  const chartsUsing = (key: string) => customCharts.filter(c => c.series.some(s => s.field === key)).map(c => `"${c.title}"`);

  // The owner picks from a menu even with one chart, since it also adds charts
  const showPicker = charts.length > 1 || (!!owner && charts.length > 0);
  const pickerOption = (spec: ChartSpec) => (
    <button
      key={spec.id}
      onClick={() => {
        selectChart(spec.id);
        setIsOpen(false);
      }}
      className={`${menuOptionClasses(chartId === spec.id)} px-4`}
    >
      <span className="flex-1 min-w-0 truncate">{chartLabel(spec)}</span>
      {!spec.custom && fields.find(f => f.key === spec.series[0].field)?.expression !== undefined && (
        <Calculator className="w-3.5 h-3.5 shrink-0 text-ink-subtle" aria-label="Calculated" />
      )}
    </button>
  );

  return (
    <section>
      <PaneHeading action={
        <>
          {owner && (chart?.custom || calculatedField) && (
            <IconButton
              size="sm"
              onClick={() => setEditing(chart!.custom ? { kind: 'chart', id: chart!.id } : { kind: 'calculated', key: calculatedField!.key })}
              title={`Edit ${chart!.custom ? chart!.title : calculatedField!.title}`}
              aria-label={`Edit ${chart!.custom ? chart!.title : calculatedField!.title}`}
            >
              <Pencil className="w-5 h-5" />
            </IconButton>
          )}
          {showPicker && (
            <div className="relative min-w-0">
              <Button variant="ghost" size="xs" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} className="max-w-48">
                <span className="truncate">{chart && chartLabel(chart)}</span>
                <ChevronDown className="w-4 h-4 shrink-0" />
              </Button>
              {isOpen && (
                <>
                  <MenuBackdrop onClose={() => setIsOpen(false)} />
                  <div className={`${MENU_PANEL} absolute right-0 top-full mt-1 w-60 max-h-96 overflow-y-auto`}>
                    {customCharts.map(pickerOption)}
                    {customCharts.length > 0 && fieldCharts.length > 0 && <div className={MENU_SEPARATOR} />}
                    {fieldCharts.map(pickerOption)}
                    {owner && (
                      <>
                        <div className={MENU_SEPARATOR} />
                        <button
                          className={MENU_ITEM}
                          onClick={() => {
                            setIsOpen(false);
                            setEditing({ kind: 'chart', id: null });
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          New chart
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          {/* With only one chart, just its name, in place of the picker */}
          {!showPicker && chart && (
            <span className="text-sm font-medium text-ink-muted truncate">{chartLabel(chart)}</span>
          )}

          {/* Dots, for yes or no or a choice by entry, are neither bars nor a line */}
          {shown && !drawnAsDots(shown, fields) && (
            <SegmentedControl
              label="Chart type"
              options={CHART_TYPE_OPTIONS}
              value={kind}
              onChange={type => {
                setChartTypes(prev => ({ ...prev, [chartId]: type }));
                rememberChartType(habitId, chartId, type);
              }}
            />
          )}
        </>
      }>
        Trends
      </PaneHeading>

      <div className={`${PANE_SURFACE} ${PANE_INSET} py-4`}>
        {!chart ? (
          // Only the owner gets here: a habit with no number fields to chart on their own
          <div className="w-full h-64 flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-ink-subtle text-sm">Nothing charted yet. Ask for a chart, like how many times a week you do this.</p>
            <Button variant="outline" size="sm" onClick={() => setEditing({ kind: 'chart', id: null })}>
              <Plus className="w-4 h-4" />
              New chart
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {problem ? (
              <div className="w-full h-64 flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-ink-subtle text-sm">This chart can&apos;t be drawn: {problem.charAt(0).toLowerCase() + problem.slice(1)}.</p>
                {owner && chart.custom && (
                  <Button variant="outline" size="sm" onClick={() => setEditing({ kind: 'chart', id: chart.id })}>
                    <Pencil className="w-4 h-4" />
                    Fix chart
                  </Button>
                )}
              </div>
            ) : (
              <ChartView spec={shown!} kind={kind} rows={rows} fields={fields} timeZone={context.timeZone} people={people} onPointClick={showEntry} />
            )}
            {/* Shown even when the chart can't be drawn by its period, so another can be picked */}
            {choices.length > 0 && (
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs font-medium text-ink-muted">By</span>
                <SegmentedControl
                  label="Show by"
                  options={choices.map(c => ({ value: c.id, label: c.label }))}
                  // None is picked when the chart's own period isn't one it can be switched to
                  value={choice?.id ?? periodChoiceId(chart.period)}
                  onChange={id => {
                    setChartPeriods(prev => ({ ...prev, [chartId]: id }));
                    rememberChartPeriod(habitId, chartId, id);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {owner && editing?.kind === 'chart' && (
        <ChartSheet
          habitId={habitId}
          schema={owner.schema}
          calculatedFields={owner.calculatedFields}
          initial={editingChart}
          entries={entries}
          context={context}
          onDone={saveEditedChart}
          onRemove={editingChart ? () => {
            setConfirmingRemove({ kind: 'chart', id: editingChart.id, title: editingChart.title });
            setEditing(null);
          } : undefined}
          onClose={() => setEditing(null)}
        />
      )}

      {owner && editing?.kind === 'calculated' && (
        <CalculatedFieldSheet
          schema={owner.schema}
          initial={owner.calculatedFields.find(f => f.key === editing.key)}
          entries={entries}
          doneLabel="Save"
          onDone={saveCalculated}
          onRemove={() => {
            const field = owner.calculatedFields.find(f => f.key === editing.key);
            setConfirmingRemove({ kind: 'calculated', id: editing.key, title: field?.title ?? 'this field' });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        isOpen={confirmingRemove !== null}
        title={confirmingRemove?.kind === 'chart' ? 'Remove Chart' : 'Remove Calculated Field'}
        message={confirmingRemove?.kind === 'chart'
          ? `Remove the "${confirmingRemove.title}" chart? Nothing you've logged changes.`
          : `Remove "${confirmingRemove?.title}"? It's worked out from each entry, so nothing you've logged changes.${
              confirmingRemove && chartsUsing(confirmingRemove.id).length > 0 ? ` The ${chartsUsing(confirmingRemove.id).join(', ')} chart uses it, and will need fixing.` : ''
            }`}
        confirmText="Remove"
        isProcessing={removing}
        onConfirm={() => confirmingRemove && remove(confirmingRemove)}
        onCancel={() => setConfirmingRemove(null)}
      />
    </section>
  );
}
