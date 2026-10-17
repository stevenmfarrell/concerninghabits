import { prisma } from './prisma';
import { parseCivilDayKey } from './timezone';
import { getMembership, getOwnedCategory } from './access';

// Skipping a habit or category for a day, as a given user (see access.ts), so the web app and the API
// skip the same way. These don't refresh any pages; the actions do that after. Server-only.

// What can be skipped: a habit, or a category with a cadence of its own (see CategorySkip)
export interface Skippable {
  kind: 'habit' | 'category';
  id: string;
}

// Checks `userId` can skip it, as anyone who has a habit can, the same as logging it, and only a
// category's owner, as for anything about a category
async function checkSkippable(userId: string, target: Skippable) {
  if (target.kind === 'habit') await getMembership(userId, target.id);
  else await getOwnedCategory(userId, target.id);
}

// Skips it on `day`, a civil day key (see HabitSkip): it counts toward its cadence like an entry
// that day would (see CadenceSnapshot). A habit's skip is the habit's, for everyone who has it; a
// category's excuses its own cadence, not its habits'. Skipping it twice is one skip.
export async function skipOn(userId: string, target: Skippable, day: string) {
  if (!parseCivilDayKey(day)) throw new Error('Invalid day');
  await checkSkippable(userId, target);
  if (target.kind === 'habit') {
    await prisma.habitSkip.upsert({ where: { habitId_day: { habitId: target.id, day } }, create: { habitId: target.id, day, userId }, update: {} });
  } else {
    await prisma.categorySkip.upsert({ where: { categoryId_day: { categoryId: target.id, day } }, create: { categoryId: target.id, day }, update: {} });
  }
}

// Takes back its skip on `day` (see skipOn), if it has one
export async function unskipOn(userId: string, target: Skippable, day: string) {
  if (!parseCivilDayKey(day)) throw new Error('Invalid day');
  await checkSkippable(userId, target);
  if (target.kind === 'habit') await prisma.habitSkip.deleteMany({ where: { habitId: target.id, day } });
  else await prisma.categorySkip.deleteMany({ where: { categoryId: target.id, day } });
}
