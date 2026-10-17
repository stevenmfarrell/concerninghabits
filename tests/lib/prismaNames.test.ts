import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';

// 🏃🏽‍♀️ written with a skin tone and the color-emoji selector, as a phone keyboard sends it
const RUNNER = '\u{1F3C3}\u{1F3FD}‍♀️';
const CLEANED = '\u{1F3C3}‍♀';

describe('names read from the database', () => {
  it('come back without color emoji marks, on the record and on related records', async () => {
    const user = await prisma.user.create({ data: { name: `Pat ${RUNNER}`, email: `pat-${crypto.randomUUID()}@example.test` } });
    expect(user.name).toBe(`Pat ${CLEANED}`);
    const habit = await prisma.habit.create({ data: { name: `${RUNNER} Run`, schema: '{}', userId: user.id } });
    await prisma.habitMember.create({ data: { habitId: habit.id, userId: user.id } });

    const membership = await prisma.habitMember.findFirstOrThrow({ where: { habitId: habit.id }, include: { habit: true, user: true } });
    expect(membership.habit.name).toBe(`${CLEANED} Run`);
    expect(membership.user.name).toBe(`Pat ${CLEANED}`);
    // Stored as written
    const [stored] = await prisma.$queryRawUnsafe<{ name: string }[]>('SELECT name FROM Habit WHERE id = ?', habit.id);
    expect(stored.name).toBe(`${RUNNER} Run`);
  });

  it('leave an entry\'s values alone, even a field called name', async () => {
    const user = await prisma.user.create({ data: { name: 'Sam', email: `sam-${crypto.randomUUID()}@example.test` } });
    const habit = await prisma.habit.create({ data: { name: 'Climb', schema: '{}', userId: user.id } });
    const log = await prisma.habitLog.create({ data: { habitId: habit.id, userId: user.id, payload: JSON.stringify({ name: RUNNER }) } });
    const [read] = await prisma.habitLog.findMany({ where: { id: log.id }, select: { payload: true, habit: { select: { name: true } } } });
    expect(JSON.parse(read.payload).name).toBe(RUNNER);
  });
});
