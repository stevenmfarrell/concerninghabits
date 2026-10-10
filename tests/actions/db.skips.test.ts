import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { cookieJar, setSessionCookie } from '../setup';
import { createCategory, deleteCategory, deleteHabit, getCategoriesWithHierarchy, getCategory, getHabit, getUncategorizedHabits, saveHabit, setHabitSharing, skipCategory, skipHabit, unskipCategory, unskipHabit } from '@/app/actions/db';
import { TIMEZONE_COOKIE, civilDayKey, toCivilDate } from '@/lib/timezone';

const testSchema = { type: 'object' as const, properties: {} };

async function createTestUser(name: string) {
  const user = await prisma.user.create({
    data: { name, email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.test`, passwordHash: 'x', bedtime: '00:00' },
  });
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt: new Date('2100-01-01') },
  });
  return { user, sessionId: session.id };
}

describe('skipping a habit', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  // Today in UTC with a midnight bedtime, which is how skipHabit sees it here
  const today = () => civilDayKey(toCivilDate(new Date(), 'UTC'));

  beforeEach(async () => {
    owner = await createTestUser('Owner');
    setSessionCookie(owner.sessionId);
    cookieJar.set(TIMEZONE_COOKIE, 'UTC');
  });

  it('skips it for the viewer\'s today, once however often it\'s asked', async () => {
    const habit = await saveHabit('Run', '', testSchema);
    expect(await skipHabit(habit.id)).toBe(today());
    await skipHabit(habit.id);
    expect((await getHabit(habit.id))?.skippedDays).toEqual([today()]);
    expect((await getUncategorizedHabits()).find(h => h.id === habit.id)?.skips).toEqual([{ day: today() }]);
  });

  it('takes a skip back', async () => {
    const habit = await saveHabit('Run', '', testSchema);
    const day = await skipHabit(habit.id);
    await unskipHabit(habit.id, day);
    expect((await getHabit(habit.id))?.skippedDays).toEqual([]);
    await expect(unskipHabit(habit.id, 'not a day')).rejects.toThrow('Invalid day');
  });

  it('lets anyone the habit is shared with skip it, for everyone, and no one else', async () => {
    const habit = await saveHabit('Trash', '', testSchema);
    const member = await createTestUser('Member');
    await setHabitSharing(habit.id, [member.user.id]);

    setSessionCookie(member.sessionId);
    await skipHabit(habit.id);
    setSessionCookie(owner.sessionId);
    expect((await getHabit(habit.id))?.skippedDays).toEqual([today()]);

    setSessionCookie((await createTestUser('Outsider')).sessionId);
    await expect(skipHabit(habit.id)).rejects.toThrow('Unauthorized');
    await expect(unskipHabit(habit.id, today())).rejects.toThrow('Unauthorized');
  });

  it('goes with the habit when it\'s deleted', async () => {
    const habit = await saveHabit('Run', '', testSchema);
    await skipHabit(habit.id);
    await deleteHabit(habit.id);
    expect(await prisma.habitSkip.count({ where: { habitId: habit.id } })).toBe(0);
  });
});

describe('skipping a category', () => {
  let owner: Awaited<ReturnType<typeof createTestUser>>;
  const today = () => civilDayKey(toCivilDate(new Date(), 'UTC'));

  beforeEach(async () => {
    owner = await createTestUser('Owner');
    setSessionCookie(owner.sessionId);
    cookieJar.set(TIMEZONE_COOKIE, 'UTC');
  });

  it('skips it for today, shown with it and its subcategories, and takes it back', async () => {
    const fitness = await createCategory('Fitness');
    const cardio = await createCategory('Cardio', undefined, fitness.id);
    expect(await skipCategory(fitness.id)).toBe(today());
    await skipCategory(cardio.id);
    const [listed] = (await getCategoriesWithHierarchy()).filter(c => c.id === fitness.id);
    expect(listed.skips).toEqual([{ day: today() }]);
    expect(listed.children[0].skips).toEqual([{ day: today() }]);
    expect((await getCategory(fitness.id))?.skips).toEqual([{ day: today() }]);

    await unskipCategory(fitness.id, today());
    expect((await getCategory(fitness.id))?.skips).toEqual([]);
    await expect(unskipCategory(fitness.id, 'not a day')).rejects.toThrow('Invalid day');
  });

  it('doesn\'t let anyone else skip it', async () => {
    const fitness = await createCategory('Fitness');
    setSessionCookie((await createTestUser('Other')).sessionId);
    await expect(skipCategory(fitness.id)).rejects.toThrow('Unauthorized');
    await expect(unskipCategory(fitness.id, today())).rejects.toThrow('Unauthorized');
  });

  it('goes with the category when it\'s deleted', async () => {
    const fitness = await createCategory('Fitness');
    await skipCategory(fitness.id);
    await deleteCategory(fitness.id);
    expect(await prisma.categorySkip.count({ where: { categoryId: fitness.id } })).toBe(0);
  });
});
