import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { importHabitLogsCsv } from '@/app/actions/csv';
import { logHabitEvent, updateHabitLog } from '@/app/actions/entries';
import { saveHabit } from '@/app/actions/habits';
import { MAX_LOG_PAYLOAD_BYTES } from '@/lib/constants';
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

  it('rejects entries over the size limit, counting bytes rather than characters', async () => {
    // Up to the limit fits; `{"distance":3,"notes":""}` is 25 bytes
    await logHabitEvent(habitId, { distance: 3, notes: 'a'.repeat(MAX_LOG_PAYLOAD_BYTES - 25) });
    await expect(logHabitEvent(habitId, { distance: 3, notes: 'a'.repeat(MAX_LOG_PAYLOAD_BYTES) })).rejects.toThrow('too long');
    // 4 bytes each in UTF-8, so well under the limit in characters but over it in bytes
    await expect(logHabitEvent(habitId, { distance: 3, notes: '🏃'.repeat(1100) })).rejects.toThrow('too long');

    const log = await logHabitEvent(habitId, { distance: 3 });
    await expect(updateHabitLog(log.id, habitId, { distance: 3, notes: 'a'.repeat(MAX_LOG_PAYLOAD_BYTES) })).rejects.toThrow('too long');
    expect(JSON.parse((await prisma.habitLog.findUnique({ where: { id: log.id } }))!.payload)).toEqual({ distance: 3 });
  });

  it('skips imported rows over the size limit', async () => {
    const result = await importHabitLogsCsv(habitId, `Date,Distance,notes\n2026-01-01,3,short\n2026-01-02,4,${'a'.repeat(MAX_LOG_PAYLOAD_BYTES)}\n`);
    expect(result.imported).toBe(1);
    expect(result.errors).toEqual([expect.stringMatching(/^Row 3: This entry is too long/)]);
  });
});
