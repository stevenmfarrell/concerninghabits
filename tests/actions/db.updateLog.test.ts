import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { logHabitEvent, saveHabit, updateHabitLog } from '@/app/actions/db';
import type { HabitSchema } from '@/lib/types';

const runSchema: HabitSchema = {
  type: 'object',
  properties: { distance: { type: 'number', title: 'Distance' }, notes: { type: 'string' } },
  required: ['distance'],
};

describe('updateHabitLog', () => {
  let habitId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { name: 'Runner', email: `runner-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
    });
    const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    setSessionCookie(session.id);
    habitId = (await saveHabit('Run', '', runSchema)).id;
  });

  it('replaces the values, dropping fields the habit doesn\'t have, and keeps the time unless given', async () => {
    const log = await logHabitEvent(habitId, { distance: 3 });
    await updateHabitLog(log.id, habitId, { distance: 2.5, notes: 'windy', extra: 'dropped' });

    const updated = await prisma.habitLog.findUnique({ where: { id: log.id } });
    expect(JSON.parse(updated!.payload)).toEqual({ distance: 2.5, notes: 'windy' });
    expect(updated!.createdAt).toEqual(log.createdAt);
  });

  it('rejects values the habit\'s form doesn\'t accept, leaving the entry as it was', async () => {
    const log = await logHabitEvent(habitId, { distance: 3 });
    await expect(updateHabitLog(log.id, habitId, { notes: 'no distance' })).rejects.toThrow('Invalid log data');
    await expect(updateHabitLog(log.id, habitId, { distance: 3 }, new Date('not a date'))).rejects.toThrow('Invalid date');

    expect(JSON.parse((await prisma.habitLog.findUnique({ where: { id: log.id } }))!.payload)).toEqual({ distance: 3 });
  });
});
