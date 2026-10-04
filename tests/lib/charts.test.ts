import { describe, expect, it } from 'vitest';
import { defaultCharts, formatPlotted, plottableFields, seriesPoints } from '@/lib/charts';
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
