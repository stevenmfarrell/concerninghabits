'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { parseHabitSchema } from '@/lib/habitSchema';
import { calculatedFieldProblem, calculatedFieldSchema, MAX_CALCULATED_FIELDS, parseCalculatedFields, type CalculatedField } from '@/lib/calculatedFields';
import { fieldsOf, keyFor } from '@/lib/formFields';
import { chartProblem, chartSpecSchema, MAX_CHARTS, newChartId, parseCharts, plottableFields, type SavedChartInput } from '@/lib/charts';
import { checkCalculatedFields } from './internal';
import { getOwnedHabit } from '@/lib/access';
import { getDefaultUser } from './user';

// Adds a calculated field to a habit (`key` null), or changes one, saving straight away, e.g. from
// the habit page's Trends. Owner only, like the rest of the habit's definition. Unlike saving the
// whole habit, the formula has to work with the form as it is. Returns the field as saved, with its
// key: a new one's is made from its title.
export async function saveCalculatedField(habitId: string, key: string | null, field: Omit<CalculatedField, 'key'>) {
  const user = await getDefaultUser();
  const habit = await getOwnedHabit(user.id, habitId);
  const schema = parseHabitSchema(habit.schema);
  const existing = parseCalculatedFields(habit.calculatedFields);
  if (key !== null && !existing.some(f => f.key === key)) throw new Error('That calculated field no longer exists');
  if (key === null && existing.length >= MAX_CALCULATED_FIELDS) throw new Error(`A habit can have at most ${MAX_CALCULATED_FIELDS} calculated fields`);

  const fieldKey = key ?? keyFor(field.title, [...Object.keys(fieldsOf(schema)), ...existing.map(f => f.key)]);
  const saved = calculatedFieldSchema.parse({ ...field, key: fieldKey });
  const problem = calculatedFieldProblem(saved, schema);
  if (problem) throw new Error(problem);

  const next = key === null ? [...existing, saved] : existing.map(f => (f.key === key ? saved : f));
  await prisma.habit.update({ where: { id: habitId }, data: { calculatedFields: JSON.stringify(checkCalculatedFields(next, schema)) } });
  revalidatePath(`/log/${habitId}`);
  return saved;
}

// Removes a calculated field from a habit. Owner only. Nothing logged changes, since a calculated
// field's values are worked out rather than stored.
export async function deleteCalculatedField(habitId: string, key: string) {
  const user = await getDefaultUser();
  const habit = await getOwnedHabit(user.id, habitId);
  const remaining = parseCalculatedFields(habit.calculatedFields).filter(f => f.key !== key);
  await prisma.habit.update({ where: { id: habitId }, data: { calculatedFields: JSON.stringify(remaining) } });
  revalidatePath(`/log/${habitId}`);
}

// Adds a chart to a habit (`chart.id` null), or changes one, along with any calculated fields it
// needs that the habit doesn't have yet (e.g. a pace, for a chart of weekly average pace), in one
// save. Owner only. A new calculated field's `key` is only what the chart's series call it: it's
// saved under a key made from its title, and the chart is changed to match.
//
// A new chart of one field with a point per entry is that field's own chart (see defaultCharts), so
// only its calculated field, if it's new, is saved. Returns the chart as saved (null when it wasn't),
// the id of the chart to show (a field's own chart's id is its key), and the calculated fields added.
export async function saveChart(
  habitId: string,
  chart: Omit<SavedChartInput, 'id'> & { id: string | null },
  newCalculatedFields: CalculatedField[] = [],
) {
  const user = await getDefaultUser();
  const habit = await getOwnedHabit(user.id, habitId);
  const schema = parseHabitSchema(habit.schema);
  const existingFields = parseCalculatedFields(habit.calculatedFields);
  const existingCharts = parseCharts(habit.charts);
  if (chart.id !== null && !existingCharts.some(c => c.id === chart.id)) throw new Error('That chart no longer exists');
  if (chart.id === null && existingCharts.length >= MAX_CHARTS) throw new Error(`A habit can have at most ${MAX_CHARTS} charts`);

  // Each new calculated field under a key of its own, checked against the form
  const takenKeys = [...Object.keys(fieldsOf(schema)), ...existingFields.map(f => f.key)];
  const renamed = new Map<string, string>();
  const added: CalculatedField[] = [];
  for (const field of newCalculatedFields) {
    const key = keyFor(field.title, takenKeys);
    takenKeys.push(key);
    const saved = calculatedFieldSchema.parse({ ...field, key });
    const problem = calculatedFieldProblem(saved, schema);
    if (problem) throw new Error(`${saved.title}: ${problem}`);
    renamed.set(field.key, key);
    added.push(saved);
  }
  const calculatedFields = checkCalculatedFields([...existingFields, ...added], schema);

  const saved = chartSpecSchema.parse({
    ...chart,
    id: chart.id ?? newChartId(),
    series: chart.series.map(series => ({ ...series, field: series.field === null ? null : renamed.get(series.field) ?? series.field })),
  });
  const problem = chartProblem(saved, plottableFields(schema, calculatedFields));
  if (problem) throw new Error(problem);

  const [onlySeries] = saved.series;
  if (chart.id === null && saved.period === 'entry' && saved.series.length === 1 && onlySeries.field !== null) {
    if (added.length > 0) await prisma.habit.update({ where: { id: habitId }, data: { calculatedFields: JSON.stringify(calculatedFields) } });
    revalidatePath(`/log/${habitId}`);
    return { chart: null, showId: onlySeries.field, calculatedFields: added };
  }

  const charts = chart.id === null ? [...existingCharts, saved] : existingCharts.map(c => (c.id === chart.id ? saved : c));
  await prisma.habit.update({
    where: { id: habitId },
    data: { charts: JSON.stringify(charts), calculatedFields: JSON.stringify(calculatedFields) },
  });
  revalidatePath(`/log/${habitId}`);
  return { chart: saved, showId: saved.id, calculatedFields: added };
}

// Removes a chart from a habit. Owner only. Calculated fields made for it are kept.
export async function deleteChart(habitId: string, chartId: string) {
  const user = await getDefaultUser();
  const habit = await getOwnedHabit(user.id, habitId);
  const remaining = parseCharts(habit.charts).filter(c => c.id !== chartId);
  await prisma.habit.update({ where: { id: habitId }, data: { charts: JSON.stringify(remaining) } });
  revalidatePath(`/log/${habitId}`);
}
