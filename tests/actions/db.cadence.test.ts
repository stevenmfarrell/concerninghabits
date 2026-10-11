import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { createCategory, setCategoryCadence } from '@/app/actions/categories';
import { saveHabit, setHabitCadence, updateHabit } from '@/app/actions/habits';
import type { Cadence } from '@/lib/cadence';

const testSchema = { type: 'object' as const, properties: {} };

async function createTestUser(name: string) {
  const user = await prisma.user.create({
    data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt: new Date('2100-01-01') },
  });
  return { user, sessionId: session.id };
}

describe('habit cadence', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    owner = await createTestUser('Owner');
    setSessionCookie(owner.sessionId);
  });

  it('stores the cadence a habit is saved and updated with', async () => {
    const habit = await saveHabit('Water plants', '', testSchema, undefined, { type: 'everyNDays', days: 3 });
    expect(JSON.parse(habit.cadence)).toEqual({ type: 'everyNDays', days: 3 });

    const updated = await updateHabit(habit.id, 'Water plants', '', testSchema, undefined, { type: 'calendarWeek' });
    expect(JSON.parse(updated.cadence)).toEqual({ type: 'calendarWeek' });
  });

  it('defaults to once a day', async () => {
    const habit = await saveHabit('Stretch', '', testSchema);
    expect(JSON.parse(habit.cadence)).toEqual({ type: 'daily', timesPerDay: 1 });
  });

  it('rejects a cadence that isn\'t valid, since it comes from the browser', async () => {
    await expect(saveHabit('Bad', '', testSchema, undefined, { type: 'everyNDays', days: 0 } as Cadence)).rejects.toThrow();
    await expect(saveHabit('Bad', '', testSchema, undefined, { type: 'fortnightly' } as unknown as Cadence)).rejects.toThrow();
  });

  it('lets the owner change just the cadence', async () => {
    const habit = await saveHabit('Water plants', '', testSchema);
    await setHabitCadence(habit.id, { type: 'everyNDays', days: 4 });
    const stored = await prisma.habit.findUniqueOrThrow({ where: { id: habit.id } });
    expect(JSON.parse(stored.cadence)).toEqual({ type: 'everyNDays', days: 4 });
    expect(stored.name).toBe('Water plants');
  });

  it('doesn\'t let anyone else change the cadence', async () => {
    const habit = await saveHabit('Water plants', '', testSchema);
    setSessionCookie((await createTestUser('Other')).sessionId);
    await expect(setHabitCadence(habit.id, { type: 'none' })).rejects.toThrow('Unauthorized');

    setSessionCookie(owner.sessionId);
    await expect(setHabitCadence(habit.id, { type: 'everyNDays', days: 1 } as Cadence)).rejects.toThrow();
  });

  it('lets a user give their own category a cadence, starting from none', async () => {
    const category = await createCategory('Cardio');
    expect(JSON.parse(category.cadence)).toEqual({ type: 'none' });

    await setCategoryCadence(category.id, { type: 'daily', timesPerDay: 1 });
    const stored = await prisma.category.findUniqueOrThrow({ where: { id: category.id } });
    expect(JSON.parse(stored.cadence)).toEqual({ type: 'daily', timesPerDay: 1 });
  });

  it('doesn\'t let anyone else set a category\'s cadence, or set an invalid one', async () => {
    const category = await createCategory('Cardio');
    await expect(setCategoryCadence(category.id, { type: 'everyNDays', days: 1 } as Cadence)).rejects.toThrow();

    setSessionCookie((await createTestUser('Other')).sessionId);
    await expect(setCategoryCadence(category.id, { type: 'calendarWeek' })).rejects.toThrow('Unauthorized');
  });
});
