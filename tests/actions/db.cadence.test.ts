import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { saveHabit, updateHabit } from '@/app/actions/db';
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
  beforeEach(async () => {
    setSessionCookie((await createTestUser('Owner')).sessionId);
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
});
