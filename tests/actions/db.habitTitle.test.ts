import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { saveHabit, updateHabit } from '@/app/actions/db';

const testSchema = { type: 'object' as const, properties: {} };

describe('habit titles', () => {
  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { name: 'Titler', email: `titler-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
    });
    const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    setSessionCookie(session.id);
  });

  it('won\'t create a habit without a title', async () => {
    await expect(saveHabit('   ', '', testSchema)).rejects.toThrow('Give your habit a title');
  });

  it('won\'t clear an existing habit\'s title', async () => {
    const habit = await saveHabit('Read', '', testSchema);
    await expect(updateHabit(habit.id, '', '', testSchema)).rejects.toThrow('Give your habit a title');
    expect((await prisma.habit.findUnique({ where: { id: habit.id } }))?.name).toBe('Read');
  });
});
