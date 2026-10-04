import { z } from 'zod';
import type { HabitSchema } from './types';
import { fieldsOf } from './formFields';
import { calculatedFieldProblem, calculateValue, type CalculatedField } from './calculatedFields';
import { formatLogValue } from './format';
import { startOfWeek } from './cadence';
import { toCivilDate } from './timezone';

// A number a habit's entries can be charted by: one of its form's number fields, or a calculated
// field (see calculatedFields.ts) worked out from them
export interface PlottableField {
  key: string;
  title: string;
  unit?: string;
  format: 'number' | 'duration';
  // Set for a calculated field: its formula, as stored
  expression?: string;
}

// The habit's plottable fields: the form's number fields in the form's order, then its calculated
// fields. A calculated field that doesn't work with the form as it is (see calculatedFieldProblem)
// is left out, since it has no values to plot.
export function plottableFields(schema: HabitSchema, calculatedFields: CalculatedField[]): PlottableField[] {
  const formFields = Object.entries(fieldsOf(schema))
    .filter(([, field]) => field.type === 'number' || field.type === 'integer')
    .map(([key, field]): PlottableField => ({
      key,
      title: field.title || key,
      unit: field['x-unit'],
      format: field['x-widget'] === 'duration' ? 'duration' : 'number',
    }));
  const calculated = calculatedFields
    .filter(field => !calculatedFieldProblem(field, schema))
    .map(({ key, title, unit, format, expression }): PlottableField => ({ key, title, unit, format, expression }));
  return [...formFields, ...calculated];
}

// A plottable field's value for one entry, or null when the entry has none
export function plottedValue(field: PlottableField, payload: Record<string, unknown>): number | null {
  if (field.expression !== undefined) {
    return calculateValue(field.expression, payload);
  }
  const value = payload[field.key];
  return typeof value === 'number' ? value : null;
}

// A plotted value as text, e.g. "3.1 miles" or "9:30"
export function formatPlotted(value: unknown, field: Pick<PlottableField, 'unit' | 'format'> | undefined) {
  return formatLogValue(value, field && { 'x-widget': field.format === 'duration' ? 'duration' : undefined, 'x-unit': field.unit });
}

// --- Charts ---

// How a period's entries combine into one value. `count` is how many entries the period has (that
// have a value for the series' field, when it has one).
export const AGGREGATES = ['sum', 'avg', 'min', 'max', 'count'] as const;
export type Aggregate = (typeof AGGREGATES)[number];

export const AGGREGATE_LABELS: Record<Aggregate, string> = { sum: 'Total', avg: 'Average', min: 'Lowest', max: 'Highest', count: 'Entries' };

export const MAX_SERIES = 3;
export const MAX_ROLLING_DAYS = 30;
export const MAX_CHARTS = 20;

// A line (or set of bars) on a chart: a plottable field's values, or the entries themselves when
// `field` is null (only counted). `fn` combines a period's entries when the chart is shown by day,
// week or month (a total for a distance, an average for a pace), and is unused with a point per
// entry. A saved chart always has it, since its viewers can switch it to any period.
export const chartSeriesSchema = z.object({
  field: z.string().max(64).nullable(),
  fn: z.enum(AGGREGATES).optional(),
});

// What a chart has a point for: each entry, each calendar day, week (by the user's week start) or
// month, or each day over the `rollingDays` days up to it (e.g. a 7-day average).
export const chartPeriodSchema = z.union([
  z.enum(['entry', 'day', 'week', 'month']),
  z.object({ rollingDays: z.number().int().min(2).max(MAX_ROLLING_DAYS) }),
]);

// A chart the habit's owner made (stored as JSON in Habit.charts): up to three series, either on
// one `shared` axis (so in the same unit) or `separate`, stacked panels over the same dates, each
// scaled to its own values (e.g. systolic and diastolic blood pressure, whose movements would flatten
// on one axis, or values in different units). `period` is what it's shown by unless the viewer
// switches it (see periodChoices), so a title names what's charted, not the period.
export const chartSpecSchema = z.object({
  id: z.string().regex(/^c_[A-Za-z0-9]{1,32}$/),
  title: z.string().trim().min(1).max(100),
  kind: z.enum(['line', 'bar']),
  period: chartPeriodSchema,
  series: z.array(chartSeriesSchema.extend({ fn: z.enum(AGGREGATES) })).min(1).max(MAX_SERIES),
  layout: z.enum(['shared', 'separate']).default('shared'),
});

export type ChartSeries = z.infer<typeof chartSeriesSchema>;
export type ChartPeriod = z.infer<typeof chartPeriodSchema>;
export type SavedChart = z.infer<typeof chartSpecSchema>;
// A chart as given to be saved, where `layout` may be left out (shared)
export type SavedChartInput = z.input<typeof chartSpecSchema>;

// What drawing a chart needs: its series (whether or not they say how to combine) and its period
export type ChartShape = { series: ChartSeries[]; period: ChartPeriod; layout?: 'shared' | 'separate' };

// Any chart on a habit's page: one it was given (`custom`) or one of the defaults, a chart per
// plottable field with a point per entry, whose series don't say how to combine. A default chart's
// id is its field's key, which is what the chartField_<habit> cookie has always stored.
export type ChartSpec = (SavedChart & { custom: true }) | (Omit<SavedChart, 'series'> & { series: ChartSeries[]; custom: false });

// The periods a saved chart can be switched between: each day, week or month, its own rolling window
// if it has one, and each entry, unless it counts entries (which needs periods to count in) or has
// two lines of one field (e.g. a week's total and longest distance), which by entry are the same.
// `id` is the choice as the chartPeriod_<habit>_<chart> cookie stores it.
export function periodChoices(spec: ChartShape): { id: string; period: ChartPeriod; label: string }[] {
  const counts = spec.series.some(s => s.field === null || s.fn === 'count');
  const fields = spec.series.map(s => s.field);
  const byEntry = !counts && new Set(fields).size === fields.length;
  return [
    ...(!byEntry ? [] : [{ id: 'entry', period: 'entry' as const, label: 'Entry' }]),
    { id: 'day', period: 'day' as const, label: 'Day' },
    { id: 'week', period: 'week' as const, label: 'Week' },
    { id: 'month', period: 'month' as const, label: 'Month' },
    ...(typeof spec.period === 'object' ? [{ id: 'rolling', period: spec.period, label: `${spec.period.rollingDays}-day` }] : []),
  ];
}

export function periodChoiceId(period: ChartPeriod) {
  return typeof period === 'object' ? 'rolling' : period;
}

export function defaultCharts(fields: PlottableField[]): ChartSpec[] {
  return fields.map(field => ({ id: field.key, title: field.title, kind: 'line' as const, period: 'entry' as const, layout: 'shared' as const, series: [{ field: field.key }], custom: false as const }));
}

export function newChartId() {
  return `c_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

// A habit's charts as stored. Anything unreadable is dropped rather than breaking the page.
export function parseCharts(raw: string | null | undefined): SavedChart[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      const result = chartSpecSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

// The unit and format a series' values are in: its field's, or entries when it counts them
export function seriesUnit(series: ChartSeries, fields: PlottableField[], period: ChartPeriod) {
  if (series.field === null || (period !== 'entry' && series.fn === 'count')) return { unit: 'entries', format: 'number' as const };
  const field = fields.find(f => f.key === series.field);
  return { unit: field?.unit, format: field?.format ?? ('number' as const) };
}

// The unit and format a chart's values are in (on a shared axis its series all share one; see
// chartProblem). With separate axes, each series' own is seriesUnit's.
export function chartUnit(spec: ChartShape, fields: PlottableField[]) {
  return seriesUnit(spec.series[0], fields, spec.period);
}

// Why a chart can't be drawn from the habit's fields, or null when it can
export function chartProblem(spec: ChartShape, fields: PlottableField[]): string | null {
  const byEntry = spec.period === 'entry';
  for (const series of spec.series) {
    if (series.field !== null && !fields.some(f => f.key === series.field)) return `Uses "${series.field}", which this habit doesn't have (any more)`;
    if (byEntry && series.field === null) return 'Counting entries needs a day, week or month to count them in';
    if (!byEntry && !series.fn) return 'Say how each period\'s entries combine, e.g. a total or an average';
    if (series.field === null && series.fn !== 'count') return 'Entries themselves can only be counted';
  }
  const keys = spec.series.map(s => `${s.field}:${byEntry ? '' : s.fn}`);
  if (new Set(keys).size !== keys.length) {
    return byEntry
      ? 'With a point per entry, two lines of the same field are the same line: show it by day, week or month'
      : 'The same line is on the chart twice';
  }
  const units = spec.series.map(s => JSON.stringify(seriesUnit(s, fields, spec.period)));
  if (spec.layout !== 'separate' && new Set(units).size > 1) return 'Lines in different units can\'t share an axis: give each its own';
  return null;
}

// A series' name, e.g. "Distance", "Total Distance", "Entries"
export function seriesLabel(series: ChartSeries, fields: PlottableField[], period: ChartPeriod) {
  if (series.field === null) return 'Entries';
  const title = fields.find(f => f.key === series.field)?.title ?? series.field;
  if (period === 'entry' || !series.fn) return title;
  return series.fn === 'count' ? `Entries with ${title}` : `${AGGREGATE_LABELS[series.fn]} ${title}`;
}

// What a chart has a point for, in words, e.g. "Each entry", "Per week", "7-day rolling"
export function periodLabel(period: ChartPeriod) {
  if (typeof period === 'object') return `${period.rollingDays}-day rolling`;
  return { entry: 'Each entry', day: 'Per day', week: 'Per week', month: 'Per month' }[period];
}

export interface ChartContext {
  timeZone: string;
  bedtimeOffsetMinutes: number;
  weekStartsOn: string;
  // The civil days the chart covers, from the first to today
  from: Date;
  to: Date;
}

// A point on a chart: where it goes along the time axis (an entry's time, or a period's first civil
// day, as UTC-midnight ms), a value per series (null where there's none), and the entry it shows
// in the entries list when clicked: the entry itself, or a period's latest.
export interface ChartRow {
  x: number;
  values: (number | null)[];
  logId?: string;
  userId?: string;
}

const DAY_MS = 86_400_000;

function addDays(day: Date, days: number) {
  return new Date(day.getTime() + days * DAY_MS);
}

function periodStart(day: Date, period: 'day' | 'week' | 'month', weekStartsOn: string) {
  if (period === 'week') return startOfWeek(day, weekStartsOn);
  if (period === 'month') return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  return day;
}

function nextPeriod(start: Date, period: 'day' | 'week' | 'month') {
  if (period === 'month') return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return addDays(start, period === 'week' ? 7 : 1);
}

function aggregate(fn: Aggregate, values: number[], entryCount: number): number | null {
  if (fn === 'count') return entryCount;
  if (fn === 'sum') return round(values.reduce((a, b) => a + b, 0));
  if (values.length === 0) return null;
  if (fn === 'avg') return round(values.reduce((a, b) => a + b, 0) / values.length);
  return fn === 'min' ? Math.min(...values) : Math.max(...values);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

// A chart's points, oldest first. By entry, a point per entry in the chart's days with a value for
// any series. By period, a point for every day, week or month from the one the chart starts in to
// today's, including entries before the start in the first one; a total or count with no entries
// is 0, while an average, lowest or highest has no value. Rolling, a point per day from the start,
// over the days up to it, entries before the start included. A chart starts at `from`, or later, on
// the first day with an entry for it, so its time axis never runs back past its first value.
export function chartRows(spec: ChartShape, fields: PlottableField[], entries: ChartEntry[], context: ChartContext): ChartRow[] {
  const series = spec.series.map(s => ({ ...s, plotted: s.field === null ? null : fields.find(f => f.key === s.field) ?? null }));
  const parsed = entries.flatMap(entry => {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(entry.payload);
    } catch {
      return [];
    }
    return [{
      entry,
      time: new Date(entry.createdAt).getTime(),
      day: toCivilDate(entry.createdAt, context.timeZone, context.bedtimeOffsetMinutes),
      // Each series' field value for the entry (null for a series that counts entries)
      values: series.map(s => (s.plotted ? plottedValue(s.plotted, payload) : null)),
    }];
  }).sort((a, b) => a.time - b.time);

  const { period } = spec;
  // The first day with an entry the chart shows (one with a value for any series, or any entry
  // when a series counts them)
  const countsEntries = series.some(s => s.field === null);
  const firstDay = parsed.find(p => countsEntries || p.values.some(v => v !== null))?.day;
  if (!firstDay) return [];
  const start = firstDay > context.from ? firstDay : context.from;

  if (period === 'entry') {
    return parsed
      .filter(p => p.day >= context.from && p.day <= context.to && p.values.some(v => v !== null))
      .map(p => ({ x: p.time, values: p.values, logId: p.entry.id, userId: p.entry.userId }));
  }

  // The series' values over a set of entries
  const combine = (inPeriod: typeof parsed) => series.map((s, i) => {
    const withValue = s.field === null ? inPeriod : inPeriod.filter(p => p.values[i] !== null);
    return aggregate(s.fn ?? 'sum', withValue.map(p => p.values[i]!).filter(v => v !== null), withValue.length);
  });

  const rows: ChartRow[] = [];
  if (typeof period === 'object') {
    for (let day = start; day <= context.to; day = addDays(day, 1)) {
      const windowStart = addDays(day, -(period.rollingDays - 1));
      const inWindow = parsed.filter(p => p.day >= windowStart && p.day <= day);
      rows.push({ x: day.getTime(), values: combine(inWindow), logId: inWindow[inWindow.length - 1]?.entry.id });
    }
    return rows;
  }

  for (let periodFrom = periodStart(start, period, context.weekStartsOn); periodFrom <= context.to; ) {
    const periodTo = nextPeriod(periodFrom, period);
    const inPeriod = parsed.filter(p => p.day >= periodFrom && p.day < periodTo);
    rows.push({ x: periodFrom.getTime(), values: combine(inPeriod), logId: inPeriod[inPeriod.length - 1]?.entry.id });
    periodFrom = periodTo;
  }
  return rows;
}

// How a point's place on the time axis reads: an axis tick (short) or a tooltip's heading
export function formatChartX(x: number, period: ChartPeriod, timeZone: string, style: 'tick' | 'tooltip') {
  const date = new Date(x);
  if (period === 'entry') {
    return style === 'tick'
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone })
      : date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone });
  }
  // A period's x is a civil date at UTC midnight
  if (period === 'month') return date.toLocaleDateString('en-US', { month: style === 'tick' ? 'short' : 'long', year: style === 'tick' ? undefined : 'numeric', timeZone: 'UTC' });
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  if (style === 'tick') return day;
  if (period === 'week') return `Week of ${day}`;
  if (typeof period === 'object') return `${period.rollingDays} days to ${day}`;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export interface ChartEntry {
  id: string;
  createdAt: Date;
  payload: string;
  userId: string;
}

// One field's points, a point per entry that has a value, oldest first
export function seriesPoints(entries: ChartEntry[], field: PlottableField) {
  return entries
    .flatMap(entry => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(entry.payload);
      } catch {
        return [];
      }
      const value = plottedValue(field, payload);
      return value === null ? [] : [{ entry, date: new Date(entry.createdAt).getTime(), value }];
    })
    .sort((a, b) => a.date - b.date);
}
