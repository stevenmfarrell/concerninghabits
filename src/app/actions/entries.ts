'use server';

import { MAX_HISTORY_WEEKS } from '@/lib/constants';
import { changeHabitLog, createHabitLog, dayEntriesOf, habitLogPresenceOf, habitLogsOf, removeHabitLog } from '@/lib/entries';
import { revalidateEntries } from './internal';
import { getDefaultUser } from './user';

// Logs an entry as the current user. `id` is the entry's id when the browser made one, so trying
// again after a lost connection can't log it twice (see createHabitLog).
export async function logHabitEvent(habitId: string, payload: Record<string, unknown>, createdAt?: Date, id?: string) {
  const log = await createHabitLog(await getDefaultUser(), habitId, payload, createdAt, id);
  revalidateEntries(habitId);
  return log;
}

// Corrects an entry's values, and its time when `createdAt` is given (see changeHabitLog)
export async function updateHabitLog(logId: string, habitId: string, payload: Record<string, unknown>, createdAt?: Date) {
  await changeHabitLog((await getDefaultUser()).id, logId, habitId, payload, createdAt);
  revalidateEntries(habitId);
}

export async function deleteHabitLog(logId: string, habitId: string) {
  await removeHabitLog((await getDefaultUser()).id, logId, habitId);
  revalidateEntries(habitId);
}

// The current user's own entries on one of their days, for the History view (see dayEntriesOf)
export async function getDayEntries(dayKey: string) {
  return dayEntriesOf(await getDefaultUser(), dayKey);
}

// A habit's entries, everyone's, newest first, back far enough for a calendar of `weeks` weeks (see
// habitLogsOf). Pass the widest horizon the caller might display.
export async function getHabitLogs(habitId: string, weeks: number = MAX_HISTORY_WEEKS) {
  return habitLogsOf((await getDefaultUser()).id, habitId, weeks);
}

// Whether a habit has any entries, and any from someone besides its owner (see habitLogPresenceOf)
export async function getHabitLogPresence(habitId: string) {
  return habitLogPresenceOf((await getDefaultUser()).id, habitId);
}
