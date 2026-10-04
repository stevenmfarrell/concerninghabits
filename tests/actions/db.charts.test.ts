import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { deleteChart, saveCalculatedField, saveChart, saveHabit, setHabitSharing } from '@/app/actions/db';
import { parseCalculatedFields } from '@/lib/calculatedFields';
import { parseCharts } from '@/lib/charts';
import type { HabitSchema } from '@/lib/types';

const runSchema: HabitSchema = {
  type: 'object',
  properties: {
    distance: { type: 'number', title: 'Distance', 'x-unit': 'miles' } as HabitSchema,
    duration: { type: 'number', title: 'Duration', 'x-widget': 'duration' } as HabitSchema,
  },
};

const weeklyMiles = { id: null, title: 'Miles per week', kind: 'bar' as const, period: 'week' as const, series: [{ field: 'distance', fn: 'sum' as const }] };

async function createTestUser(name: string) {
  const user = await prisma.user.create({
    data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt: new Date('2100-01-01') },
  });
  return { user, sessionId: session.id };
}

async function stored(habitId: string) {
  const habit = await prisma.habit.findUniqueOrThrow({ where: { id: habitId } });
  return { charts: parseCharts(habit.charts), calculatedFields: parseCalculatedFields(habit.calculatedFields) };
}

describe('charts', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let habitId: string;

  beforeEach(async () => {
    owner = await createTestUser('Owner');
    setSessionCookie(owner.sessionId);
    habitId = (await saveHabit('Run', '', runSchema)).id;
  });

  it('adds a chart under a new id, then changes and removes it', async () => {
    const { chart, showId } = await saveChart(habitId, weeklyMiles);
    expect(chart!.id).toMatch(/^c_/);
    expect(showId).toBe(chart!.id);
    expect((await stored(habitId)).charts).toEqual([chart]);

    await saveChart(habitId, { ...weeklyMiles, id: chart!.id, title: 'Weekly miles', period: 'month' });
    expect((await stored(habitId)).charts).toEqual([{ ...chart, title: 'Weekly miles', period: 'month' }]);

    await deleteChart(habitId, chart!.id);
    expect((await stored(habitId)).charts).toEqual([]);
  });

  it("saves a new chart of one field by entry as just that field's own chart", async () => {
    const result = await saveChart(
      habitId,
      { id: null, title: 'Pace', kind: 'line', period: 'entry', series: [{ field: 'p', fn: 'avg' }] },
      [{ key: 'p', title: 'Pace', expression: 'duration / distance', format: 'duration' }],
    );
    expect(result.chart).toBeNull();
    expect(result.showId).toBe('pace');
    expect(await stored(habitId)).toEqual({ charts: [], calculatedFields: [{ key: 'pace', title: 'Pace', expression: 'duration / distance', format: 'duration' }] });
  });

  it('adds the calculated fields a chart needs in the same save, under keys of their own', async () => {
    await saveCalculatedField(habitId, null, { title: 'Pace', expression: 'duration', format: 'duration' });
    const { chart, calculatedFields } = await saveChart(
      habitId,
      { id: null, title: 'Weekly pace', kind: 'line', period: 'week', series: [{ field: 'newPace', fn: 'avg' }] },
      [{ key: 'newPace', title: 'Pace', expression: 'duration / distance', unit: 'min/mile', format: 'duration' }],
    );
    expect(calculatedFields.map(f => f.key)).toEqual(['pace2']);
    expect(chart!.series).toEqual([{ field: 'pace2', fn: 'avg' }]);
    expect((await stored(habitId)).calculatedFields.map(f => f.key)).toEqual(['pace', 'pace2']);
  });

  it("saves nothing when the chart or a new field doesn't work", async () => {
    await expect(saveChart(habitId, { ...weeklyMiles, series: [{ field: 'speed', fn: 'sum' }] })).rejects.toThrow("doesn't have");
    await expect(saveChart(habitId, weeklyMiles, [{ key: 'bad', title: 'Bad', expression: 'nope * 2', format: 'number' }])).rejects.toThrow("the form doesn't have");
    await expect(saveChart(habitId, { ...weeklyMiles, series: [{ field: 'distance', fn: 'sum' }, { field: 'duration', fn: 'sum' }] })).rejects.toThrow('different units');
    await expect(saveChart(habitId, { ...weeklyMiles, id: 'c_missing' })).rejects.toThrow('no longer exists');
    expect(await stored(habitId)).toEqual({ charts: [], calculatedFields: [] });
  });

  it('saves lines in different units when each has its own axis', async () => {
    const { chart } = await saveChart(habitId, { ...weeklyMiles, layout: 'separate', series: [{ field: 'distance', fn: 'sum' }, { field: 'duration', fn: 'sum' }] });
    expect((await stored(habitId)).charts).toEqual([chart]);
    expect(chart!.layout).toBe('separate');
  });

  it('only lets the owner change them, even on a shared habit', async () => {
    const { chart } = await saveChart(habitId, weeklyMiles);
    const member = await createTestUser('Member');
    await setHabitSharing(habitId, [member.user.id]);

    setSessionCookie(member.sessionId);
    await expect(saveChart(habitId, weeklyMiles)).rejects.toThrow('Unauthorized');
    await expect(deleteChart(habitId, chart!.id)).rejects.toThrow('Unauthorized');
    expect((await stored(habitId)).charts).toEqual([chart]);
  });
});
