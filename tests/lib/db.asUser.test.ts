import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { createHabitLog, habitLogsOf, removeHabitLog } from '@/lib/entries';
import { skipOn, unskipOn } from '@/lib/skips';
import { habitDetailOf } from '@/lib/habitDetails';
import { dueListOf } from '@/lib/agenda';
import { todayKeyFor } from '@/lib/timezone';

// The shared functions behind the server actions take the user they act as, so the API can call
// them as whoever its key belongs to: they work with nobody signed in, and check access the same way.
describe('logging, skipping, the due list and habit details for a given user', () => {
  const makeUser = (name: string) => prisma.user.create({ data: { name, email: `${name}-${crypto.randomUUID()}@example.test`, passwordHash: 'x', timeZone: 'UTC' } });
  let owner: Awaited<ReturnType<typeof makeUser>>;
  let member: Awaited<ReturnType<typeof makeUser>>;
  let stranger: Awaited<ReturnType<typeof makeUser>>;
  let habitId: string;
  const asUser = (user: typeof owner) => ({ ...user, timeZone: 'UTC', vacations: [] });

  beforeAll(async () => {
    setSessionCookie(undefined);
    [owner, member, stranger] = await Promise.all([makeUser('owner'), makeUser('member'), makeUser('stranger')]);
    const habit = await prisma.habit.create({
      data: {
        userId: owner.id, name: 'Stretch', schema: '{"type":"object","properties":{}}', cadence: JSON.stringify({ type: 'daily', timesPerDay: 1 }),
        members: { create: [{ userId: owner.id }, { userId: member.id }] },
      },
    });
    habitId = habit.id;
  });

  it('logs as the user given, and lists their entries with who can change them', async () => {
    const log = await createHabitLog(member, habitId, {});
    expect(log.userId).toBe(member.id);
    const asOwner = await habitLogsOf(owner.id, habitId);
    expect(asOwner.find(l => l.id === log.id)?.canChange).toBe(true);

    await expect(createHabitLog(stranger, habitId, {})).rejects.toThrow('Unauthorized');
    await expect(habitLogsOf(stranger.id, habitId)).rejects.toThrow('Unauthorized');
    await expect(removeHabitLog(stranger.id, log.id, habitId)).rejects.toThrow('Unauthorized');
    await removeHabitLog(member.id, log.id, habitId);
    expect(await habitLogsOf(owner.id, habitId)).toEqual([]);
  });

  it('describes the habit from the user\'s side', async () => {
    const asOwner = await habitDetailOf(owner.id, habitId);
    expect(asOwner?.isOwner).toBe(true);
    expect(asOwner?.memberIds.toSorted()).toEqual([owner.id, member.id].toSorted());
    expect(await habitDetailOf(member.id, habitId)).toMatchObject({ isOwner: false });
    expect(await habitDetailOf(stranger.id, habitId)).toBeNull();
  });

  it('shows the habit due, and skipped once the member skips it, for everyone who has it', async () => {
    expect((await dueListOf(asUser(owner))).dueHabits.map(h => h.id)).toEqual([habitId]);

    const today = todayKeyFor(asUser(member));
    await skipOn(member.id, { kind: 'habit', id: habitId }, today);
    const list = await dueListOf(asUser(owner));
    expect(list.dueHabits).toEqual([]);
    expect(list.skippedHabitIds).toEqual([habitId]);
    expect((await habitDetailOf(owner.id, habitId))?.skippedDays).toEqual([today]);

    await expect(skipOn(stranger.id, { kind: 'habit', id: habitId }, today)).rejects.toThrow('Unauthorized');
    await unskipOn(member.id, { kind: 'habit', id: habitId }, today);
    expect((await dueListOf(asUser(owner))).dueHabits.map(h => h.id)).toEqual([habitId]);
  });

  it('doesn\'t show anyone else\'s habits in a stranger\'s due list', async () => {
    const list = await dueListOf(asUser(stranger));
    expect([...list.dueHabits, ...list.upcomingHabits.map(u => u.item), ...list.recentHabits, ...list.uncategorized].map(h => h.id)).not.toContain(habitId);
  });
});
