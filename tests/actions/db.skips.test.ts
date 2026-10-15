import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { cookieJar, setSessionCookie, connectSignedInUserTo } from '../setup';
import { createCategory, deleteCategory, getCategoriesWithHierarchy, getCategory } from '@/app/actions/categories';
import { deleteHabit, getHabit, getUncategorizedHabits, saveHabit, setHabitSharing } from '@/app/actions/habits';
import { skipToday, undoSkip } from '@/app/actions/skips';
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
  // Today in UTC with a midnight bedtime, which is how skipToday sees it here
  const today = () => civilDayKey(toCivilDate(new Date(), 'UTC'));

  beforeEach(async () => {
    owner = await createTestUser('Owner');
    setSessionCookie(owner.sessionId);
    cookieJar.set(TIMEZONE_COOKIE, 'UTC');
  });

  it('skips it for the viewer\'s today, once however often it\'s asked', async () => {
    const habit = await saveHabit('Run', '', testSchema);
    expect(await skipToday({ kind: 'habit', id: habit.id })).toBe(today());
    await skipToday({ kind: 'habit', id: habit.id });
    expect((await getHabit(habit.id))?.skippedDays).toEqual([today()]);
    expect((await getUncategorizedHabits()).find(h => h.id === habit.id)?.skips).toEqual([{ day: today() }]);
  });

  it('takes a skip back', async () => {
    const habit = await saveHabit('Run', '', testSchema);
    const day = await skipToday({ kind: 'habit', id: habit.id });
    await undoSkip({ kind: 'habit', id: habit.id }, day);
    expect((await getHabit(habit.id))?.skippedDays).toEqual([]);
    await expect(undoSkip({ kind: 'habit', id: habit.id }, 'not a day')).rejects.toThrow('Invalid day');
  });

  it('lets anyone the habit is shared with skip it, for everyone, and no one else', async () => {
    const habit = await saveHabit('Trash', '', testSchema);
    const member = await createTestUser('Member');
    await connectSignedInUserTo(member.user.id);
    await setHabitSharing(habit.id, [member.user.id]);

    setSessionCookie(member.sessionId);
    await skipToday({ kind: 'habit', id: habit.id });
    setSessionCookie(owner.sessionId);
    expect((await getHabit(habit.id))?.skippedDays).toEqual([today()]);

    setSessionCookie((await createTestUser('Outsider')).sessionId);
    await expect(skipToday({ kind: 'habit', id: habit.id })).rejects.toThrow('Unauthorized');
    await expect(undoSkip({ kind: 'habit', id: habit.id }, today())).rejects.toThrow('Unauthorized');
  });

  it('goes with the habit when it\'s deleted', async () => {
    const habit = await saveHabit('Run', '', testSchema);
    await skipToday({ kind: 'habit', id: habit.id });
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
    expect(await skipToday({ kind: 'category', id: fitness.id })).toBe(today());
    await skipToday({ kind: 'category', id: cardio.id });
    const [listed] = (await getCategoriesWithHierarchy()).filter(c => c.id === fitness.id);
    expect(listed.skips).toEqual([{ day: today() }]);
    expect(listed.children[0].skips).toEqual([{ day: today() }]);
    expect((await getCategory(fitness.id))?.skips).toEqual([{ day: today() }]);

    await undoSkip({ kind: 'category', id: fitness.id }, today());
    expect((await getCategory(fitness.id))?.skips).toEqual([]);
    await expect(undoSkip({ kind: 'category', id: fitness.id }, 'not a day')).rejects.toThrow('Invalid day');
  });

  it('doesn\'t let anyone else skip it', async () => {
    const fitness = await createCategory('Fitness');
    setSessionCookie((await createTestUser('Other')).sessionId);
    await expect(skipToday({ kind: 'category', id: fitness.id })).rejects.toThrow('Unauthorized');
    await expect(undoSkip({ kind: 'category', id: fitness.id }, today())).rejects.toThrow('Unauthorized');
  });

  it('goes with the category when it\'s deleted', async () => {
    const fitness = await createCategory('Fitness');
    await skipToday({ kind: 'category', id: fitness.id });
    await deleteCategory(fitness.id);
    expect(await prisma.categorySkip.count({ where: { categoryId: fitness.id } })).toBe(0);
  });
});
