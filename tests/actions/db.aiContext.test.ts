import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { getHabit, getLoggableHabits, saveHabit, setHabitAiContext, setHabitSharing, updateHabit } from '@/app/actions/habits';
import { MAX_AI_CONTEXT_LENGTH } from '@/lib/constants';

const testSchema = { type: 'object' as const, properties: {} };

async function createTestUser(name: string) {
  const user = await prisma.user.create({
    data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x' },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  return { user, sessionId: session.id };
}

describe('per-member context for AI', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  let member: Awaited<ReturnType<typeof createTestUser>>;
  let outsider: Awaited<ReturnType<typeof createTestUser>>;
  let habitId: string;

  const asOwner = () => setSessionCookie(owner.sessionId);
  const asMember = () => setSessionCookie(member.sessionId);
  const asOutsider = () => setSessionCookie(outsider.sessionId);

  // A cycling habit the owner created with their own context, shared with one member
  beforeEach(async () => {
    owner = await createTestUser('Owner');
    member = await createTestUser('Member');
    outsider = await createTestUser('Outsider');

    asOwner();
    const habit = await saveHabit('Cycling', '', testSchema, undefined, { type: 'daily', timesPerDay: 1 }, false, '  Bike commute is 4 miles, 30 minutes.  ');
    habitId = habit.id;
    await setHabitSharing(habitId, [member.user.id]);
  });

  it('saves the creator\'s context, trimmed, on their own membership', async () => {
    asOwner();
    expect((await getHabit(habitId))?.aiContext).toBe('Bike commute is 4 miles, 30 minutes.');
    expect((await getLoggableHabits()).find(h => h.id === habitId)?.aiContext).toBe('Bike commute is 4 miles, 30 minutes.');
  });

  it('keeps each member\'s context separate on a shared habit', async () => {
    asMember();
    expect((await getHabit(habitId))?.aiContext).toBeNull();
    await setHabitAiContext(habitId, 'My commute is 7 miles.');
    expect((await getHabit(habitId))?.aiContext).toBe('My commute is 7 miles.');

    asOwner();
    expect((await getHabit(habitId))?.aiContext).toBe('Bike commute is 4 miles, 30 minutes.');
  });

  it('lets the owner change or clear their context when editing the habit', async () => {
    asOwner();
    await updateHabit(habitId, 'Cycling', '', testSchema, undefined, { type: 'daily', timesPerDay: 1 }, false, 'Commute is 5 miles now.');
    expect((await getHabit(habitId))?.aiContext).toBe('Commute is 5 miles now.');

    await updateHabit(habitId, 'Cycling', '', testSchema, undefined, { type: 'daily', timesPerDay: 1 }, false, '   ');
    expect((await getHabit(habitId))?.aiContext).toBeNull();
  });

  it('refuses context over the length limit without changing anything', async () => {
    asOwner();
    const tooLong = 'x'.repeat(MAX_AI_CONTEXT_LENGTH + 1);
    await expect(setHabitAiContext(habitId, tooLong)).rejects.toThrow();
    await expect(updateHabit(habitId, 'Renamed', '', testSchema, undefined, { type: 'daily', timesPerDay: 1 }, false, tooLong)).rejects.toThrow();

    const habit = await getHabit(habitId);
    expect(habit?.name).toBe('Cycling');
    expect(habit?.aiContext).toBe('Bike commute is 4 miles, 30 minutes.');
  });

  it('doesn\'t let someone without the habit set context on it', async () => {
    asOutsider();
    await expect(setHabitAiContext(habitId, 'Sneaky')).rejects.toThrow('Unauthorized');
  });
});
