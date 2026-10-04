'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import BottomSheet from './BottomSheet';
import AiTweakInput from './AiTweakInput';
import { Button } from './ui/Button';
import { INPUT_SM } from './ui/Input';
import { SegmentedControl } from './ui/SegmentedControl';
import { generateCalculatedField } from '@/app/actions/habit';
import { calculatedFieldProblem, describeExpression, isFormulaInput, type CalculatedField } from '@/lib/calculatedFields';
import { formatPlotted, seriesPoints, type ChartEntry, type PlottableField } from '@/lib/charts';
import { fieldsOf } from '@/lib/formFields';
import type { HabitSchema } from '@/lib/types';

type FieldDraft = Omit<CalculatedField, 'key'>;

const EMPTY: FieldDraft = { title: '', expression: '', unit: undefined, format: 'number' };

const FORMAT_OPTIONS = [
  { value: 'number' as const, label: 'Number' },
  { value: 'duration' as const, label: 'Time' },
];

// How many of the latest entries the preview plots
const PREVIEW_ENTRIES = 30;

// A calculated field to add or change (see calculatedFields.ts): described for AI to write (typed or
// spoken), or written by hand, with a preview of its values over `entries` (the habit's recent
// entries, when there are any). `onDone` gets the field without its key, which is made when it's
// first saved; it may save straight away (the habit's page) or into a draft (the editor).
export default function CalculatedFieldSheet({ schema, initial, entries = [], doneLabel = 'Done', onDone, onRemove, onClose }: {
  schema: HabitSchema;
  initial?: FieldDraft;
  entries?: ChartEntry[];
  doneLabel?: string;
  onDone: (field: FieldDraft) => Promise<void> | void;
  onRemove?: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FieldDraft>(initial ?? EMPTY);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (change: Partial<FieldDraft>) => setDraft(prev => ({ ...prev, ...change }));

  const inputs = Object.entries(fieldsOf(schema)).filter(([, field]) => isFormulaInput(field));
  const hasFormula = draft.expression.trim() !== '';
  const formulaProblem = hasFormula ? calculatedFieldProblem(draft, schema) : null;
  const problem = !draft.title.trim() ? 'Give it a name' : !hasFormula ? 'Write a formula' : formulaProblem;
  const busy = generating || saving;

  const handleAsk = async (request: string) => {
    setGenerating(true);
    const result = await generateCalculatedField(request, schema, hasFormula ? draft : undefined);
    setGenerating(false);
    if (!result.success) {
      toast.error(result.error);
      return false;
    }
    setDraft(result.field);
    return true;
  };

  const run = async (action: () => Promise<void> | void) => {
    setSaving(true);
    try {
      await action();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
      setSaving(false);
    }
  };

  // Typing a field's key into the formula, from its chip
  const insertKey = (key: string) => {
    const expression = draft.expression.trimEnd();
    set({ expression: expression ? `${expression} ${key}` : key });
  };

  return (
    <BottomSheet title={initial ? 'Edit calculated field' : 'New calculated field'} onClose={onClose}>
      <div className="space-y-5">
        {inputs.length === 0 ? (
          <p className="text-sm text-ink-muted">Calculated fields are worked out from a habit&apos;s number or yes-or-no fields, and this habit has none yet.</p>
        ) : (
          <>
            {/* Asking AI, set apart from the fields it fills in below */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-accent-ink-strong">
                {hasFormula ? 'Ask AI to change it' : 'Ask AI to work it out'}
              </p>
              <AiTweakInput
                onApply={handleAsk}
                applying={generating}
                disabled={saving}
                fills="below"
                submitLabel="Ask AI"
                speakLabel="Say what you'd like"
                placeholder={hasFormula ? 'e.g. "make it km/h"' : 'e.g. "pace per mile"'}
                applyingPlaceholder="Working it out..."
                label="Describe a value for AI to work out from each entry"
              />
              <p className="text-xs text-ink-muted">
                {hasFormula
                  ? 'AI updates the fields below for you to check.'
                  : "Say what you'd like to see, worked out from each entry's values. AI fills in the fields below for you to check."}
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-ink-subtle" aria-hidden="true">
              <span className="flex-1 border-t border-line-subtle" />
              {hasFormula ? 'or change it yourself' : 'or set it up yourself'}
              <span className="flex-1 border-t border-line-subtle" />
            </div>

            <form
              className="space-y-5"
              onSubmit={e => {
                e.preventDefault();
                if (!problem && !busy) run(() => onDone({ ...draft, title: draft.title.trim(), expression: draft.expression.trim(), unit: draft.unit?.trim() || undefined }));
              }}
            >
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium text-ink-secondary">Name</span>
                <input
                  type="text"
                  className={INPUT_SM}
                  value={draft.title}
                  onChange={e => set({ title: e.target.value })}
                  placeholder='e.g. "Pace"'
                  autoComplete="off"
                  data-1p-ignore
                  disabled={busy}
                />
              </label>

              <div className="space-y-1.5">
                <label htmlFor="calculated-formula" className="block text-sm font-medium text-ink-secondary">Formula</label>
                <input
                  id="calculated-formula"
                  type="text"
                  className={`${INPUT_SM} font-mono`}
                  value={draft.expression}
                  onChange={e => set({ expression: e.target.value })}
                  placeholder="e.g. duration / distance"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-1p-ignore
                  disabled={busy}
                />
                {formulaProblem ? (
                  <p className="text-xs text-danger-ink">{formulaProblem}</p>
                ) : hasFormula ? (
                  <p className="text-xs text-ink-muted">= {describeExpression(draft.expression, schema)}</p>
                ) : null}
                {/* The fields a formula can use, by key, to tap into it */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {inputs.map(([key, field]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => insertKey(key)}
                      disabled={busy}
                      title={`Add ${field.title || key} to the formula`}
                      className="px-2 py-0.5 rounded-md bg-surface-muted text-xs font-mono text-ink-secondary hover:bg-surface-strong transition-colors"
                    >
                      {key}
                    </button>
                  ))}
                  <span className="text-xs text-ink-subtle self-center">with + − * / ( )</span>
                </div>
              </div>

              <div className="flex gap-3">
                <label className="flex-1 min-w-0 space-y-1.5">
                  <span className="block text-sm font-medium text-ink-secondary">Unit <span className="font-normal text-ink-subtle">(optional)</span></span>
                  <input
                    type="text"
                    className={INPUT_SM}
                    value={draft.unit ?? ''}
                    onChange={e => set({ unit: e.target.value })}
                    placeholder='e.g. "min/mile"'
                    autoComplete="off"
                    data-1p-ignore
                    disabled={busy}
                  />
                </label>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <span className="block text-sm font-medium text-ink-secondary">Show as</span>
                  {/* Two choices, so segments rather than a dropdown. A time is worked out in minutes and shown as m:ss. */}
                  <SegmentedControl
                    size="md"
                    label="Show as"
                    options={FORMAT_OPTIONS}
                    value={draft.format}
                    onChange={format => set({ format })}
                  />
                </div>
              </div>

              {hasFormula && !formulaProblem && <Preview field={draft} entries={entries} />}

              <div className={`flex items-center gap-3 ${onRemove ? 'justify-between' : 'justify-end'}`}>
                {onRemove && (
                  <Button type="button" variant="danger-ghost" onClick={() => run(onRemove)} disabled={busy}>
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </Button>
                )}
                <Button type="submit" disabled={!!problem || busy} title={problem ?? undefined}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {doneLabel}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

// The field's values over the latest entries, as a small line, with the latest value
function Preview({ field, entries }: { field: FieldDraft; entries: ChartEntry[] }) {
  const plotted: PlottableField = useMemo(
    () => ({ key: '__preview', title: field.title, unit: field.unit?.trim() || undefined, format: field.format, expression: field.expression }),
    [field.title, field.unit, field.format, field.expression],
  );
  const points = useMemo(() => seriesPoints(entries, plotted).slice(-PREVIEW_ENTRIES), [entries, plotted]);

  if (entries.length === 0) return null;
  if (points.length === 0) {
    return <p className="text-sm text-ink-muted">None of the recent entries have the values this needs.</p>;
  }

  const latest = points[points.length - 1];
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink-secondary">Recent entries</span>
        <span className="text-sm text-ink-muted">Latest: <span className="font-semibold text-ink">{formatPlotted(latest.value, plotted)}</span></span>
      </div>
      <div className="h-24 rounded-lg bg-surface-subtle px-2 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              cursor={false}
              contentStyle={{ backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--line)', fontSize: 12 }}
              labelFormatter={(_label, payload) => {
                const date = (payload?.[0]?.payload as { date?: number } | undefined)?.date;
                return date === undefined ? '' : new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
              formatter={(value: unknown) => [formatPlotted(value, plotted), field.title || 'Value']}
            />
            <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
