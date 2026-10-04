import { describe, expect, it } from 'vitest';
import { chartProblem, chartRows, periodChoices, chartUnit, defaultCharts, formatChartX, formatPlotted, parseCharts, periodLabel, plottableFields, seriesLabel, seriesPoints } from '@/lib/charts';
import type { CalculatedField } from '@/lib/calculatedFields';
import type { HabitSchema } from '@/lib/types';

const runSchema: HabitSchema = {
  type: 'object',
  properties: {
    distance: { type: 'number', title: 'Distance', 'x-unit': 'miles' } as HabitSchema,
    duration: { type: 'number', title: 'Duration', 'x-widget': 'duration' } as HabitSchema,
    notes: { type: 'string', title: 'Notes' },
  },
};

const pace: CalculatedField = { key: 'pace', title: 'Pace', expression: 'duration / distance', unit: 'min/mile', format: 'duration' };
const broken: CalculatedField = { key: 'speed', title: 'Speed', expression: 'distance / time', format: 'number' };

const entry = (id: string, day: number, payload: unknown) => ({ id, createdAt: new Date(2026, 9, day), payload: JSON.stringify(payload), userId: 'u' });

describe('charts', () => {
  it("lists the form's number fields, then calculated fields that work with the form", () => {
    const fields = plottableFields(runSchema, [pace, broken]);
    expect(fields.map(f => f.key)).toEqual(['distance', 'duration', 'pace']);
    expect(fields[1]).toEqual({ key: 'duration', title: 'Duration', unit: undefined, format: 'duration' });
    expect(fields[2]).toMatchObject({ key: 'pace', format: 'duration', expression: 'duration / distance' });
    expect(defaultCharts(fields).map(c => c.id)).toEqual(['distance', 'duration', 'pace']);
  });

  it('plots a calculated field per entry that has its values, oldest first', () => {
    const [, , paceField] = plottableFields(runSchema, [pace]);
    const points = seriesPoints([
      entry('c', 3, { distance: 2, duration: 20 }),
      entry('a', 1, { distance: 3, duration: 27 }),
      entry('b', 2, { distance: 3 }),
      { ...entry('d', 4, {}), payload: 'not json' },
    ], paceField);
    expect(points.map(p => [p.entry.id, p.value])).toEqual([['a', 9], ['c', 10]]);
    expect(formatPlotted(9.5, paceField)).toBe('9:30');
  });
});

describe('custom charts', () => {
  const fields = plottableFields(runSchema, [pace]);
  // Civil days in UTC, no bedtime, weeks from Monday. Oct 5 2026 is a Monday.
  const context = { timeZone: 'UTC', bedtimeOffsetMinutes: 0, weekStartsOn: 'monday', from: day(5), to: day(18) };
  const run = (id: string, date: number, hour: number, payload: unknown) => ({ id, createdAt: new Date(Date.UTC(2026, 9, date, hour)), payload: JSON.stringify(payload), userId: 'u' });
  const entries = [
    run('a', 3, 12, { distance: 1, duration: 10 }), // the week before the chart starts
    run('b', 5, 12, { distance: 3, duration: 27 }),
    run('c', 7, 12, { distance: 2, duration: 20 }),
    run('d', 14, 12, { duration: 30 }),
    run('e', 15, 12, { distance: 4, duration: 36 }),
  ];
  function day(date: number) {
    return new Date(Date.UTC(2026, 9, date));
  }
  const values = (rows: { values: (number | null)[] }[]) => rows.map(r => r.values);

  it('rolls entries up by week: totals and counts are 0 in an empty week, averages have none', () => {
    const rows = chartRows({ period: 'week', series: [{ field: 'distance', fn: 'sum' }, { field: 'distance', fn: 'avg' }] }, fields, entries, context);
    expect(rows.map(r => r.x)).toEqual([day(5), day(12)].map(d => d.getTime()));
    expect(values(rows)).toEqual([[5, 2.5], [4, 4]]);

    const counts = chartRows({ period: 'week', series: [{ field: null, fn: 'count' }, { field: 'distance', fn: 'count' }] }, fields, entries, { ...context, to: day(25) });
    expect(values(counts)).toEqual([[2, 2], [2, 1], [0, 0]]);
    const avg = chartRows({ period: 'week', series: [{ field: 'distance', fn: 'avg' }] }, fields, entries, { ...context, to: day(25) });
    expect(values(avg)).toEqual([[2.5], [4], [null]]);
  });

  it('starts a week on the user\'s week start, counting entries before the chart\'s first day', () => {
    const rows = chartRows({ period: 'week', series: [{ field: 'distance', fn: 'sum' }] }, fields, entries, { ...context, weekStartsOn: 'sunday', from: day(5) });
    // Sunday Oct 4 to Saturday Oct 10, then Oct 11, then Oct 18
    expect(rows.map(r => new Date(r.x).getUTCDate())).toEqual([4, 11, 18]);
    expect(values(rows)).toEqual([[5], [4], [0]]);
    const fromSunday = chartRows({ period: 'week', series: [{ field: 'distance', fn: 'sum' }] }, fields, entries, { ...context, weekStartsOn: 'sunday', from: day(1), to: day(4) });
    expect(fromSunday.map(r => new Date(r.x).getUTCDate())).toEqual([27, 4]);
    expect(values(fromSunday)).toEqual([[1], [5]]);
  });

  it('rolls up a calculated field, by month, with the latest entry to show', () => {
    const rows = chartRows({ period: 'month', series: [{ field: 'pace', fn: 'max' }] }, fields, entries, context);
    expect(rows).toEqual([{ x: Date.UTC(2026, 9, 1), values: [10], logId: 'e' }]);
  });

  it('counts a late-night entry toward the day before, by the user\'s bedtime', () => {
    const late = [run('x', 6, 0, { distance: 1 })];
    const byDay = (bedtimeOffsetMinutes: number) => values(chartRows({ period: 'day', series: [{ field: 'distance', fn: 'sum' }] }, fields, late, { ...context, bedtimeOffsetMinutes, to: day(6) }));
    expect(byDay(0)).toEqual([[0], [1]]);
    expect(byDay(60)).toEqual([[1], [0]]);
  });

  it('works out a rolling window over the days up to each day', () => {
    const rows = chartRows({ period: { rollingDays: 3 }, series: [{ field: 'distance', fn: 'sum' }] }, fields, entries, { ...context, from: day(5), to: day(8) });
    expect(values(rows)).toEqual([[4], [3], [5], [2]]);
  });

  it('has a point per entry with a value, in the chart\'s days', () => {
    const rows = chartRows({ period: 'entry', series: [{ field: 'distance' }, { field: 'pace' }] }, fields, entries, context);
    expect(rows.map(r => [r.logId, ...r.values])).toEqual([['b', 3, 9], ['c', 2, 10], ['e', 4, 9]]);
  });

  it('says why a chart can\'t be drawn', () => {
    expect(chartProblem({ period: 'week', series: [{ field: 'distance', fn: 'sum' }, { field: 'distance', fn: 'max' }] }, fields)).toBeNull();
    expect(chartProblem({ period: 'week', series: [{ field: 'speed', fn: 'sum' }] }, fields)).toMatch(/doesn't have/);
    expect(chartProblem({ period: 'entry', series: [{ field: null, fn: 'count' }] }, fields)).toMatch(/needs a day, week or month/);
    expect(chartProblem({ period: 'week', series: [{ field: 'distance' }] }, fields)).toMatch(/combine/);
    expect(chartProblem({ period: 'week', series: [{ field: null, fn: 'sum' }] }, fields)).toMatch(/only be counted/);
    expect(chartProblem({ period: 'week', series: [{ field: 'distance', fn: 'sum' }, { field: 'distance', fn: 'sum' }] }, fields)).toMatch(/twice/);
    expect(chartProblem({ period: 'entry', series: [{ field: 'distance' }, { field: 'duration' }] }, fields)).toMatch(/different units/);
    expect(chartProblem({ period: 'week', series: [{ field: 'distance', fn: 'sum' }, { field: null, fn: 'count' }] }, fields)).toMatch(/different units/);
    // Each on its own axis, lines in different units are fine
    expect(chartProblem({ period: 'entry', layout: 'separate', series: [{ field: 'distance' }, { field: 'duration' }] }, fields)).toBeNull();
    expect(chartProblem({ period: 'week', layout: 'separate', series: [{ field: 'distance', fn: 'sum' }, { field: null, fn: 'count' }] }, fields)).toBeNull();
    expect(chartUnit({ period: 'week', series: [{ field: 'duration', fn: 'sum' }] }, fields)).toEqual({ unit: undefined, format: 'duration' });
  });

  it('names series and periods', () => {
    expect(seriesLabel({ field: 'distance', fn: 'sum' }, fields, 'week')).toBe('Total Distance');
    expect(seriesLabel({ field: 'distance', fn: 'sum' }, fields, 'entry')).toBe('Distance');
    expect(seriesLabel({ field: null, fn: 'count' }, fields, 'week')).toBe('Entries');
    expect(periodLabel({ rollingDays: 7 })).toBe('7-day rolling');
    expect(formatChartX(Date.UTC(2026, 9, 5), 'week', 'UTC', 'tooltip')).toBe('Week of Oct 5');
    expect(formatChartX(Date.UTC(2026, 9, 1), 'month', 'UTC', 'tooltip')).toBe('October 2026');
  });

  it('reads stored charts, dropping anything unreadable', () => {
    const chart = { id: 'c_abc123', title: 'Miles per week', kind: 'bar', period: 'week', series: [{ field: 'distance', fn: 'sum' }] };
    // A chart saved before it had a layout shares one axis
    expect(parseCharts(JSON.stringify([chart, { ...chart, id: 'bad id' }, { ...chart, series: [] }]))).toEqual([{ ...chart, layout: 'shared' }]);
    expect(parseCharts('nope')).toEqual([]);
  });

  it('offers the periods a chart can be switched between', () => {
    const ids = (spec: Parameters<typeof periodChoices>[0]) => periodChoices(spec).map(c => c.label);
    expect(ids({ period: 'week', series: [{ field: 'distance', fn: 'sum' }] })).toEqual(['Entry', 'Day', 'Week', 'Month']);
    // Counting entries needs periods to count in
    expect(ids({ period: 'week', series: [{ field: null, fn: 'count' }] })).toEqual(['Day', 'Week', 'Month']);
    expect(ids({ period: { rollingDays: 7 }, series: [{ field: 'distance', fn: 'avg' }] })).toEqual(['Entry', 'Day', 'Week', 'Month', '7-day']);
  });
});
