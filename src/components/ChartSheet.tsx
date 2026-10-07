'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import BottomSheet from './BottomSheet';
import AiTweakInput from './AiTweakInput';
import ChartView from './ChartView';
import Select from './Select';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { INPUT_SM } from './ui/Input';
import { SegmentedControl } from './ui/SegmentedControl';
import { generateChart, type ChartDraft } from '@/app/actions/habit';
import { describeExpression, isYesNo, type CalculatedField } from '@/lib/calculatedFields';
import {
  AGGREGATE_LABELS,
  AGGREGATES,
  chartProblem,
  chartRows,
  MAX_ROLLING_DAYS,
  MAX_SERIES,
  plottableFields,
  type Aggregate,
  type ChartContext,
  type ChartEntry,
  type ChartPeriod,
} from '@/lib/charts';
import type { HabitSchema } from '@/lib/types';

const EMPTY: ChartDraft = { title: '', kind: 'line', period: 'week', layout: 'shared', series: [{ field: null, fn: 'count' }] };

const LAYOUT_OPTIONS = [
  { value: 'shared' as const, label: 'One axis' },
  { value: 'separate' as const, label: 'Own axes' },
];

const KIND_OPTIONS = [
  { value: 'line' as const, label: 'Line' },
  { value: 'bar' as const, label: 'Bars' },
];

// Worded like the switch under a chart (see periodChoices), after "Shown by"
const PERIOD_OPTIONS = [
  { id: 'entry', label: 'Entry' },
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'rolling', label: 'Rolling window' },
];

// The Select option for a series that counts entries rather than reading a field
const ENTRIES_OPTION = '__entries';

const DEFAULT_ROLLING_DAYS = 7;

type Mode = 'ai' | 'manual';
const MODE_OPTIONS = [
  { value: 'ai' as const, label: 'Ask AI' },
  { value: 'manual' as const, label: 'Manual' },
];

// A chart to add or change (see charts.ts), in one of two modes picked at the top, both working on
// the same draft: asked of AI (typed or spoken), which can also draft the calculated fields it needs,
// or set up by hand. A new chart starts with AI, and an existing one by hand, to adjust. Either way
// its title, the fields it adds and a preview over the habit's entries are below. Nothing is saved
// until `onDone`, which gets the chart and the drafted calculated fields it adds to the habit (see
// saveChart).
export default function ChartSheet({ habitId, schema, calculatedFields, initial, entries, context, onDone, onRemove, onClose }: {
  habitId: string;
  schema: HabitSchema;
  // The habit's calculated fields, as saved
  calculatedFields: CalculatedField[];
  initial?: ChartDraft;
  entries: ChartEntry[];
  context: ChartContext;
  onDone: (chart: ChartDraft, newCalculatedFields: CalculatedField[]) => Promise<void>;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ChartDraft>(initial ?? EMPTY);
  // Calculated fields drafted for the chart, added to the habit when it's saved
  const [newFields, setNewFields] = useState<CalculatedField[]>([]);
  const [asked, setAsked] = useState(!!initial);
  const [mode, setMode] = useState<Mode>(initial ? 'manual' : 'ai');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (change: Partial<ChartDraft>) => setDraft(prev => ({ ...prev, ...change }));
  const busy = generating || saving;

  const fields = useMemo(() => plottableFields(schema, [...calculatedFields, ...newFields]), [schema, calculatedFields, newFields]);
  const settingsProblem = chartProblem(draft, fields);
  const problem = !draft.title.trim() ? 'Give the chart a title' : settingsProblem;
  const rows = useMemo(() => (settingsProblem ? [] : chartRows(draft, fields, entries, context)), [settingsProblem, draft, fields, entries, context]);
  // Until AI has made a chart, there's nothing of its to show or name
  const aiWaiting = mode === 'ai' && !asked;
  const byEntry = draft.period === 'entry';

  const handleAsk = async (request: string) => {
    setGenerating(true);
    const result = await generateChart(habitId, request, asked ? { chart: draft, newCalculatedFields: newFields } : undefined);
    setGenerating(false);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    // Keep the fields drafted before that the new chart still uses
    const used = new Set(result.chart.series.map(s => s.field));
    setNewFields(prev => [...prev.filter(f => used.has(f.key)), ...result.newCalculatedFields]);
    setDraft(result.chart);
    setAsked(true);
    return true;
  };

  const setPeriod = (id: string) => {
    const period: ChartPeriod = id === 'rolling' ? { rollingDays: typeof draft.period === 'object' ? draft.period.rollingDays : DEFAULT_ROLLING_DAYS } : (id as ChartPeriod);
    set({ period });
  };

  const setSeries = (index: number, change: Partial<ChartDraft['series'][number]>) => set({ series: draft.series.map((s, i) => (i === index ? { ...s, ...change } : s)) });

  const save = async () => {
    if (problem || busy) return;
    setSaving(true);
    try {
      // Only the drafted fields the chart uses
      const used = new Set(draft.series.map(s => s.field));
      await onDone({ ...draft, title: draft.title.trim() }, newFields.filter(f => used.has(f.key)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
      setSaving(false);
    }
  };

  const fieldOptions = [
    ...fields.map(f => ({ id: f.key, label: f.unit ? `${f.title} (${f.unit})` : f.title })),
    ...(byEntry ? [] : [{ id: ENTRIES_OPTION, label: 'Entries (a count)' }]),
  ];
  const fnOptions = AGGREGATES.map(fn => ({ id: fn, label: fn === 'count' ? 'Count' : AGGREGATE_LABELS[fn] }));
  // Entries, and a choice field (one of a list), can only be counted
  const countedOnly = (field: string | null) => field === null || fields.find(f => f.key === field)?.format === 'choice';
  // A field's series as picked: counted when it can only be, and a total when it no longer has to be
  const seriesFor = (field: string, from?: ChartDraft['series'][number]) =>
    countedOnly(field) ? { field, fn: 'count' as const } : { field, ...(!from || countedOnly(from.field) ? { fn: 'sum' as const } : {}) };

  return (
    <BottomSheet title={initial ? 'Edit chart' : 'New chart'} onClose={onClose}>
      <div className="space-y-5">
        <SegmentedControl size="md" label="How to make the chart" options={MODE_OPTIONS} value={mode} onChange={setMode} />

        {/* Hidden rather than unmounted in the other mode, so what's typed in it stays */}
        <div className={mode === 'ai' ? 'space-y-2' : 'hidden'}>
          <AiTweakInput
            onApply={handleAsk}
            applying={generating}
            disabled={saving}
            fills="below"
            placeholder={asked ? 'e.g. "make it monthly"' : 'e.g. "miles per week"'}
            applyingPlaceholder="Designing the chart..."
            label="Describe a chart for AI to make"
            submitLabel="Ask AI"
            speakLabel="Say what you'd like"
          />
          <p className="text-xs text-ink-muted">
            {asked
              ? 'AI changes the chart below for you to check, or switch to Manual to change it yourself.'
              : "Say what you'd like to see over time, e.g. a weekly total, your pace, or two values side by side. AI sets up the chart, adding any calculated fields it needs."}
          </p>
        </div>

        <form
          className="space-y-5"
          onSubmit={e => {
            e.preventDefault();
            save();
          }}
        >
          {!aiWaiting && (
            <>
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-ink-secondary">Title</span>
                <input
                  type="text"
                  className={INPUT_SM}
                  value={draft.title}
                  onChange={e => set({ title: e.target.value })}
                  placeholder='e.g. "Miles run"'
                  autoComplete="off"
                  data-1p-ignore
                  disabled={busy}
                />
              </label>

              {newFields.length > 0 && (
                <div className="space-y-1.5">
                  <span className="block text-sm font-medium text-ink-secondary">Adds calculated fields</span>
                  <ul className="rounded-lg border border-line divide-y divide-line-subtle">
                    {newFields.map(field => (
                      <li key={field.key} className="flex items-center gap-3 pl-3 pr-1 py-1.5 text-sm">
                        <span className="font-medium text-ink shrink-0">{field.title}</span>
                        <span className="flex-1 min-w-0 truncate text-ink-muted">
                          {isYesNo(field.expression) ? 'Yes when' : '='} {describeExpression(field.expression, schema)}{field.unit && !isYesNo(field.expression) ? ` · ${field.unit}` : ''}
                        </span>
                        <IconButton
                          size="sm"
                          onClick={() => setNewFields(prev => prev.filter(f => f.key !== field.key))}
                          title={`Don't add ${field.title}`}
                          aria-label={`Don't add ${field.title}`}
                          disabled={busy}
                        >
                          <X className="w-4 h-4" />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-ink-muted">Saved with the chart, and charted on their own too.</p>
                </div>
              )}
            </>
          )}

          {/* The settings AI fills in, to set by hand */}
          {mode === 'manual' && (
            <>
              <div className="flex gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <span className="block text-sm font-medium text-ink-secondary">Shown by</span>
                  <Select
                    size="sm"
                    value={typeof draft.period === 'object' ? 'rolling' : draft.period}
                    onChange={setPeriod}
                    options={PERIOD_OPTIONS}
                    disabled={busy}
                  />
                </div>
                {typeof draft.period === 'object' && (
                  <label className="w-24 space-y-1.5">
                    <span className="block text-sm font-medium text-ink-secondary">Days</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={2}
                      max={MAX_ROLLING_DAYS}
                      className={INPUT_SM}
                      value={draft.period.rollingDays}
                      onChange={e => {
                        const days = Math.round(Number(e.target.value));
                        if (days >= 2 && days <= MAX_ROLLING_DAYS) set({ period: { rollingDays: days } });
                      }}
                      disabled={busy}
                    />
                  </label>
                )}
              </div>

              <p className="text-xs text-ink-muted -mt-3">What it starts on. Anyone viewing it can switch between entries, days, weeks and months.</p>

              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-ink-secondary">{draft.series.length > 1 ? 'Lines' : 'Showing'}</span>
                <div className="space-y-2">
                  {draft.series.map((series, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-32 shrink-0">
                        <Select
                          size="sm"
                          value={series.fn}
                          onChange={fn => setSeries(i, { fn: fn as Aggregate })}
                          options={countedOnly(series.field) ? fnOptions.filter(o => o.id === 'count') : fnOptions}
                          disabled={busy}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Select
                          size="sm"
                          value={series.field ?? ENTRIES_OPTION}
                          onChange={id => setSeries(i, id === ENTRIES_OPTION ? { field: null, fn: 'count' } : seriesFor(id, series))}
                          options={fieldOptions}
                          placeholder="Pick a field"
                          disabled={busy}
                        />
                      </div>
                      {draft.series.length > 1 && (
                        <IconButton
                          size="sm"
                          onClick={() => set({ series: draft.series.filter((_, j) => j !== i) })}
                          title="Remove this line"
                          aria-label="Remove this line"
                          disabled={busy}
                        >
                          <X className="w-4 h-4" />
                        </IconButton>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-ink-muted">
                  {byEntry
                    ? 'Each entry is shown as it is. The total, average and so on are used when the chart is switched to days, weeks or months.'
                    : "How each period's entries combine, whichever period the chart is switched to."}
                </p>
                {draft.series.length < MAX_SERIES && (
                  <button
                    type="button"
                    onClick={() => set({ series: [...draft.series, fields[0] ? { fn: 'sum', ...seriesFor(fields[0].key) } : { field: null, fn: 'count' }] })}
                    disabled={busy}
                    className="flex items-center gap-2 py-1 text-sm font-medium text-accent-ink-strong"
                  >
                    <Plus className="w-4 h-4" />
                    Add a line
                  </button>
                )}
              </div>

              {draft.series.length > 1 && (
                <div className="space-y-1.5">
                  <span className="block text-sm font-medium text-ink-secondary">Lines are drawn on</span>
                  <SegmentedControl size="md" label="Lines are drawn on" options={LAYOUT_OPTIONS} value={draft.layout} onChange={layout => set({ layout })} />
                  <p className="text-xs text-ink-muted">
                    {draft.layout === 'separate'
                      ? 'A panel each, over the same dates, scaled to its own values: for values in different units, or ranges that would flatten each other.'
                      : 'One shared scale, to compare the values directly.'}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-ink-secondary">Drawn as</span>
                <SegmentedControl size="md" label="Drawn as" options={KIND_OPTIONS} value={draft.kind} onChange={kind => set({ kind })} />
              </div>
            </>
          )}

          {/* In both modes, without waiting for a title */}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-ink-secondary">Preview</span>
            {aiWaiting ? (
              <PreviewPlaceholder>{generating ? 'Designing the chart...' : 'The chart AI makes shows up here.'}</PreviewPlaceholder>
            ) : settingsProblem ? (
              <PreviewPlaceholder tone="danger">{settingsProblem}</PreviewPlaceholder>
            ) : (
              <ChartView spec={draft} kind={draft.kind} rows={rows} fields={fields} timeZone={context.timeZone} height={180} />
            )}
          </div>

          <div className={`flex items-center gap-3 ${onRemove ? 'justify-between' : 'justify-end'}`}>
            {onRemove && (
              <Button type="button" variant="danger-ghost" onClick={onRemove} disabled={busy}>
                <Trash2 className="w-4 h-4" />
                Remove chart
              </Button>
            )}
            <Button type="submit" disabled={!!problem || busy} title={problem ?? undefined}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {initial ? 'Save' : 'Add chart'}
            </Button>
          </div>
        </form>
      </div>
    </BottomSheet>
  );
}

// Where the preview goes while there's no chart to show, as tall as one, saying why
function PreviewPlaceholder({ tone = 'muted', children }: { tone?: 'muted' | 'danger'; children: ReactNode }) {
  return (
    <div className={`h-[180px] flex items-center justify-center rounded-lg border border-dashed border-line px-6 text-center text-sm ${tone === 'danger' ? 'text-danger-ink' : 'text-ink-muted'}`}>
      {children}
    </div>
  );
}
