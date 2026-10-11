'use server';

import { todayKeyFor } from '@/lib/timezone';
import { skipOn, unskipOn } from './internal';
import { getDefaultUser } from './user';

// What can be skipped: a habit, or a category with a cadence of its own (see CategorySkip)
export interface Skippable {
  kind: 'habit' | 'category';
  id: string;
}

// Skips it for today, the viewer's day, returning that day (a civil day key): it counts toward its
// cadence like an entry today would (see CadenceSnapshot). A habit's skip is the habit's, for
// everyone who has it; a category's excuses its own cadence, not its habits'.
export async function skipToday(target: Skippable) {
  const user = await getDefaultUser();
  const day = todayKeyFor(user);
  await skipOn(user.id, target, day);
  return day;
}

// Takes back its skip made on `day` (see skipToday)
export async function undoSkip(target: Skippable, day: string) {
  const user = await getDefaultUser();
  await unskipOn(user.id, target, day);
}
