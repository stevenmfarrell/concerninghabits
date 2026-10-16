import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { setSessionCookie } from '../setup';
import { getCategoriesWithHierarchy } from '@/app/actions/categories';
import { getLatestLogDates, getUncategorizedHabits } from '@/app/actions/habits';
import { getDefaultUser } from '@/app/actions/user';
import { categoryBegan, consistency } from '@/lib/consistency';
import { entryDates } from '@/lib/dueList';
import { NO_CADENCE, parseCadence, type Cadence } from '@/lib/cadence';

const DAY = 864e5;
let seed = 11;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Each list loads a habit's entries only as far back as its health, and its categories', need (see
// loadListEntries). Its health should come out the same as from every entry it has.
describe('loading only the history health needs', () => {
  it('gives every habit and category the same health as its whole history would', async () => {
    const user = await prisma.user.create({ data: { name: 'Hist', email: `hist-${crypto.randomUUID()}@example.test`, passwordHash: 'x' } });
    const session = await prisma.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 3600e3) } });
    setSessionCookie(session.id);
    const now = Date.now();

    const fitness = await prisma.category.create({ data: { userId: user.id, name: 'Fitness', cadence: JSON.stringify({ type: 'calendarMonth', times: 8 }), createdAt: new Date(now - 700 * DAY) } });
    const runs = await prisma.category.create({ data: { userId: user.id, name: 'Runs', parentId: fitness.id, cadence: JSON.stringify({ type: 'calendarWeek', times: 2 }), createdAt: new Date(now - 30 * DAY) } });
    const habits: { cadence: Cadence; categoryId: string | null; createdDaysAgo: number; entries: number[] }[] = [
      { cadence: { type: 'daily', timesPerDay: 1 }, categoryId: fitness.id, createdDaysAgo: 600, entries: [] },
      { cadence: { type: 'calendarMonth', times: 2 }, categoryId: runs.id, createdDaysAgo: 500, entries: [] },
      { cadence: { type: 'daily', timesPerDay: 1 }, categoryId: runs.id, createdDaysAgo: 400, entries: [] },
      { cadence: { type: 'everyNDays', days: 45 }, categoryId: null, createdDaysAgo: 600, entries: [] },
      { cadence: { type: 'limit', period: 'week', max: 2 }, categoryId: null, createdDaysAgo: 450, entries: [] },
      { cadence: { type: 'weekdays', days: [1, 3, 5] }, categoryId: null, createdDaysAgo: 300, entries: [] },
      // Made recently, with entries imported from long before and nothing in between
      { cadence: { type: 'daily', timesPerDay: 1 }, categoryId: null, createdDaysAgo: 20, entries: [400, 401, 402, 10, 5, 2] },
    ];
    for (const habit of habits) {
      if (habit.entries.length === 0) habit.entries = Array.from({ length: 150 + Math.floor(random() * 200) }, () => random() * 500);
      await prisma.habit.create({
        data: {
          userId: user.id, name: `Habit ${habit.cadence.type}`, schema: '{"type":"object","properties":{}}', cadence: JSON.stringify(habit.cadence),
          createdAt: new Date(now - habit.createdDaysAgo * DAY),
          members: { create: { userId: user.id, categoryId: habit.categoryId } },
          logs: { create: habit.entries.map(daysAgo => ({ userId: user.id, payload: '{}', createdAt: new Date(now - daysAgo * DAY) })) },
        },
      });
    }

    const viewer = await getDefaultUser();
    const [categories, uncategorized, latest] = await Promise.all([getCategoriesWithHierarchy(5, true), getUncategorizedHabits(5, true), getLatestLogDates()]);
    const allLogs = await prisma.habitLog.findMany({ where: { userId: user.id }, select: { habitId: true, createdAt: true } });
    const everything = (habitId: string) => allLogs.filter(log => log.habitId === habitId).map(log => log.createdAt);
    const at = new Date(now);

    const listed = [...categories.flatMap(c => [...c.habits, ...c.children.flatMap(child => child.habits)]), ...uncategorized];
    expect(listed).toHaveLength(habits.length);
    for (const habit of listed) {
      const cadence = parseCadence(habit.cadence);
      // Fewer entries loaded than it has, for most
      expect(habit.logs.length).toBeLessThanOrEqual(everything(habit.id).length);
      expect(consistency(cadence, entryDates(habit, latest), viewer, { createdAt: habit.began! }, at))
        .toEqual(consistency(cadence, everything(habit.id), viewer, { createdAt: habit.createdAt }, at));
    }
    // A habit due on three weekdays looks back about three months, so most of its 500 days aren't
    // loaded. Those in Fitness are, since its monthly cadence looks back a year.
    const weekdays = listed.find(h => parseCadence(h.cadence).type === 'weekdays')!;
    expect(weekdays.logs.length).toBeLessThan(everything(weekdays.id).length / 2);

    const [loadedFitness] = categories.filter(c => c.id === fitness.id);
    for (const [category, members] of [[loadedFitness, [...loadedFitness.habits, ...loadedFitness.children[0].habits]], [loadedFitness.children[0], loadedFitness.children[0].habits]] as const) {
      const cadence = parseCadence(category.cadence, NO_CADENCE);
      expect(consistency(cadence, members.flatMap(h => entryDates(h, latest)), viewer, { createdAt: categoryBegan(category.createdAt, members) }, at))
        .toEqual(consistency(cadence, members.flatMap(h => everything(h.id)), viewer, { createdAt: category.createdAt }, at));
    }
  });
});
