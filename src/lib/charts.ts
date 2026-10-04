import type { HabitSchema } from './types';
import { fieldsOf } from './formFields';
import { calculatedFieldProblem, calculateValue, type CalculatedField } from './calculatedFields';
import { formatLogValue } from './format';

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
export function formatPlotted(value: unknown, field: PlottableField | undefined) {
  return formatLogValue(value, field && { 'x-widget': field.format === 'duration' ? 'duration' : undefined, 'x-unit': field.unit });
}

// A chart of a habit's entries. For now every chart is one of the defaults, one per plottable
// field, with a point per entry; custom charts (several series on the same axes, rolled up by day,
// week or month) will be saved as more of these.
export interface ChartSpec {
  // A default chart's id is its field's key, which is what the chartField_<habit> cookie stores
  id: string;
  series: { field: string }[];
}

export function defaultCharts(fields: PlottableField[]): ChartSpec[] {
  return fields.map(field => ({ id: field.key, series: [{ field: field.key }] }));
}

export interface ChartEntry {
  id: string;
  createdAt: Date;
  payload: string;
  userId: string;
}

// One series' points, a point per entry that has a value, oldest first
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
