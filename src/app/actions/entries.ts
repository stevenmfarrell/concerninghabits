'use server';

import { prisma } from '@/lib/prisma';
import { MAX_HISTORY_WEEKS } from '@/lib/constants';
import { parseEntryValues } from '@/lib/habitSchema';
import { civilDateFor, civilDayKey, DAY_MS, parseCivilDayKey } from '@/lib/timezone';
import { revalidateEntries, getRecentLogsCutoff, getMembership, sanitizeLogPayload, canChangeLog, getChangeableLog, createHabitLog } from './internal';
import { getDefaultUser } from './user';

export async function logHabitEvent(habitId: string, payload: Record<string, unknown>, createdAt?: Date) {
  return createHabitLog(await getDefaultUser(), habitId, payload, createdAt);
}

// Corrects an entry's values, and its time when `createdAt` is given. Not republished to MQTT,
// which announces new entries.
export async function updateHabitLog(logId: string, habitId: string, payload: Record<string, unknown>, createdAt?: Date) {
  const user = await getDefaultUser();
  const log = await getChangeableLog(user.id, logId, habitId);
  if (createdAt && Number.isNaN(createdAt.getTime())) throw new Error('Invalid date');

  await prisma.habitLog.update({
    where: { id: logId },
    data: {
      payload: JSON.stringify(sanitizeLogPayload(log.habit, payload)),
      ...(createdAt ? { createdAt } : {}),
    },
  });
  revalidateEntries(habitId);
}

export async function deleteHabitLog(logId: string, habitId: string) {
  const user = await getDefaultUser();
  await getChangeableLog(user.id, logId, habitId);

  await prisma.habitLog.delete({
    where: { id: logId }
  });
  revalidateEntries(habitId);
}

// The current user's own entries on one of their days (`dayKey`, a civil date like "2024-03-10" in
// their time zone, with their bedtime deciding when a day ends), oldest first, for the History
// view. Only their own: on a shared habit, someone else's entry doesn't check it off for them.
export async function getDayEntries(dayKey: string) {
  const user = await getDefaultUser();
  const day = parseCivilDayKey(dayKey);
  if (!day) throw new Error('Invalid day');

  // Where a day starts and ends in UTC depends on the time zone and bedtime, so fetch a generous
  // window around it and keep the logs that fall on it exactly
  const logs = await prisma.habitLog.findMany({
    where: { userId: user.id, createdAt: { gte: new Date(day.getTime() - 2 * DAY_MS), lt: new Date(day.getTime() + 3 * DAY_MS) } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, habitId: true, payload: true, createdAt: true },
  });

  return logs
    .filter(log => civilDayKey(civilDateFor(log.createdAt, user)) === dayKey)
    .map(log => {
      return { ...log, payload: parseEntryValues(log.payload) ?? {} };
    });
}

// Every entry on a habit the user can see, whoever logged it, newest first. `canChange` says
// whether the current user may edit or delete that entry.
// A habit's logs, newest first, going back far enough for a calendar of `weeks` weeks (see
// getRecentLogsCutoff). Pass the widest horizon the caller might display.
export async function getHabitLogs(habitId: string, weeks: number = MAX_HISTORY_WEEKS) {
  const user = await getDefaultUser();
  const { habit } = await getMembership(user.id, habitId);
  const logs = await prisma.habitLog.findMany({
    where: { habitId, createdAt: { gte: getRecentLogsCutoff(weeks) } },
    orderBy: { createdAt: 'desc' }
  });
  return logs.map(log => ({ ...log, canChange: canChangeLog(user.id, log, habit) }));
}

// What the habit page's history needs to know about a habit's logs beyond getHabitLogs' window: whether it
// has any at all, and whether anyone besides the owner has ever logged it (see isSharedHabit).
export async function getHabitLogPresence(habitId: string) {
  const user = await getDefaultUser();
  const { habit } = await getMembership(user.id, habitId);
  const [anyLog, otherPersonLog] = await Promise.all([
    prisma.habitLog.findFirst({ where: { habitId }, select: { id: true } }),
    prisma.habitLog.findFirst({ where: { habitId, userId: { not: habit.userId } }, select: { id: true } }),
  ]);
  return { hasLogs: !!anyLog, hasLogsFromOthers: !!otherPersonLog };
}
