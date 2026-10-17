'use server';

import { todayKeyFor } from '@/lib/timezone';
import { skipOn, unskipOn, type Skippable } from '@/lib/skips';
import { revalidateSkip } from './internal';
import { getDefaultUser } from './user';

// Skips it for today, the viewer's day, returning that day (a civil day key; see skipOn)
export async function skipToday(target: Skippable) {
  const user = await getDefaultUser();
  const day = todayKeyFor(user);
  await skipOn(user.id, target, day);
  revalidateSkip(target);
  return day;
}

// Takes back its skip made on `day` (see skipToday)
export async function undoSkip(target: Skippable, day: string) {
  const user = await getDefaultUser();
  await unskipOn(user.id, target, day);
  revalidateSkip(target);
}
