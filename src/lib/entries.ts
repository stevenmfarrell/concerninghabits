import rjsfValidator from '@rjsf/validator-ajv8';
import { prisma } from './prisma';
import { MAX_HISTORY_WEEKS, MAX_LOG_PAYLOAD_BYTES } from './constants';
import { parseEntryValues, parseHabitSchema } from './habitSchema';
import type { HabitSchema } from './types';
import { fieldsOf } from './formFields';
import { civilDateFor, civilDayKey, DAY_MS, parseCivilDayKey, type DayOwner } from './timezone';
import { getMembership } from './access';
import { getRecentLogsCutoff } from './habitLists';
import { UnauthorizedError } from './errors';

// Logging a habit, correcting and deleting entries, and reading them back, as a given user: the web
// app's server actions act as whoever's signed in, the API as whoever its key belongs to (see
// apiKeys.ts). These don't refresh any pages; the actions do that after. Server-only.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The entry already logged with `id` by `userId` on `habitId`, or null when there's none yet. An id
// made by the browser (see src/lib/offline) can arrive more than once, e.g. when the answer to the
// first try was lost with the connection, so logging it again finds this instead of a second entry.
async function alreadyLogged(id: string, userId: string, habitId: string) {
  const existing = await prisma.habitLog.findUnique({ where: { id } });
  if (existing && (existing.userId !== userId || existing.habitId !== habitId)) throw new Error('That entry id is already used');
  return existing;
}

// Logs an entry on a habit `user` has, as them: checked like any entry (see sanitizeLogPayload),
// and published to MQTT when the habit is. `id`, when given, is the entry's id, made by the browser
// so it can be logged offline and sent later, as often as it takes: an entry already logged with it
// is returned as it is.
export async function createHabitLog(user: { id: string; name: string }, habitId: string, payload: Record<string, unknown>, createdAt?: Date, id?: string) {
  if (id !== undefined && !UUID.test(id)) throw new Error('Invalid entry id');
  if (createdAt && Number.isNaN(createdAt.getTime())) throw new Error('Invalid date');
  const { habit } = await getMembership(user.id, habitId);
  if (id) {
    const existing = await alreadyLogged(id, user.id, habitId);
    if (existing) return existing;
  }

  const sanitizedPayload = sanitizeLogPayload(habit, payload);

  let log;
  try {
    log = await prisma.habitLog.create({
      data: {
        ...(id ? { id } : {}),
        habitId,
        userId: user.id,
        payload: JSON.stringify(sanitizedPayload),
        ...(createdAt ? { createdAt } : {})
      }
    });
  } catch (error) {
    // The same entry arriving twice at once: the other one logged it
    const existing = id && await alreadyLogged(id, user.id, habitId);
    if (existing) return existing;
    throw error;
  }

  try {
    if (habit.publishToMqtt) {
      const { publishHabitLog } = await import('./mqtt');
      publishHabitLog(user, habit, sanitizedPayload);
    }
  } catch (e) {
    console.error('Failed to trigger MQTT publish', e);
  }

  return log;
}

// Corrects an entry `userId` may change (see canChangeLog): its values, and its time when `createdAt`
// is given. Not republished to MQTT, which announces new entries.
export async function changeHabitLog(userId: string, logId: string, habitId: string, payload: Record<string, unknown>, createdAt?: Date) {
  const log = await getChangeableLog(userId, logId, habitId);
  if (createdAt && Number.isNaN(createdAt.getTime())) throw new Error('Invalid date');

  await prisma.habitLog.update({
    where: { id: logId },
    data: {
      payload: JSON.stringify(sanitizeLogPayload(log.habit, payload)),
      ...(createdAt ? { createdAt } : {}),
    },
  });
}

// Deletes an entry `userId` may change (see canChangeLog)
export async function removeHabitLog(userId: string, logId: string, habitId: string) {
  await getChangeableLog(userId, logId, habitId);
  await prisma.habitLog.delete({ where: { id: logId } });
}

// An entry's values with any keys the habit's own schema doesn't define dropped, validated against
// the schema the same as the client-side rjsf Form would. The browser only enforces this in the UI.
export function sanitizeLogPayload(habit: { schema: string }, payload: Record<string, unknown>) {
  const schema: HabitSchema = { type: 'object', ...parseHabitSchema(habit.schema) };
  const properties = fieldsOf(schema);
  const sanitizedPayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key in properties)
  );

  const { errors } = rjsfValidator.validateFormData(sanitizedPayload, schema);
  if (errors.length > 0) {
    throw new Error(`Invalid log data: ${errors.map(e => e.stack).join('; ')}`);
  }
  const problem = payloadSizeProblem(sanitizedPayload);
  if (problem) throw new Error(problem);
  return sanitizedPayload;
}

// Why an entry's values are too big to store (see MAX_LOG_PAYLOAD_BYTES), or null if they fit
function payloadSizeProblem(payload: Record<string, unknown>) {
  const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  if (bytes <= MAX_LOG_PAYLOAD_BYTES) return null;
  return `This entry is too long (${(bytes / 1024).toFixed(1)} KB; the limit is ${MAX_LOG_PAYLOAD_BYTES / 1024} KB)`;
}

// Anyone can edit or delete an entry they logged; a habit's owner can also edit or delete anyone's
// entry on it
export function canChangeLog(userId: string, log: { userId: string }, habit: { userId: string }) {
  return log.userId === userId || habit.userId === userId;
}

// An entry the user may edit or delete, checked to belong to `habitId`
export async function getChangeableLog(userId: string, logId: string, habitId: string) {
  const log = await prisma.habitLog.findUnique({ where: { id: logId }, include: { habit: { select: { userId: true, schema: true } } } });
  if (!log || log.habitId !== habitId || !canChangeLog(userId, log, log.habit)) throw new UnauthorizedError();
  return log;
}

// The user's own entries on one of their days (`dayKey`, a civil date like "2024-03-10" in their
// time zone, with their bedtime deciding when a day ends), oldest first, for the History view. Only
// their own: on a shared habit, someone else's entry doesn't check it off for them.
export async function dayEntriesOf(user: { id: string } & DayOwner, dayKey: string) {
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
    .map(log => ({ ...log, payload: parseEntryValues(log.payload) ?? {} }));
}

// Every entry on a habit the user can see, whoever logged it, newest first, going back far enough
// for a calendar of `weeks` weeks (see getRecentLogsCutoff). `canChange` says whether the user may
// edit or delete that entry.
export async function habitLogsOf(userId: string, habitId: string, weeks: number = MAX_HISTORY_WEEKS) {
  const { habit } = await getMembership(userId, habitId);
  const logs = await prisma.habitLog.findMany({
    where: { habitId, createdAt: { gte: getRecentLogsCutoff(weeks) } },
    orderBy: { createdAt: 'desc' }
  });
  return logs.map(log => ({ ...log, canChange: canChangeLog(userId, log, habit) }));
}

// What a habit's history needs to know about its logs beyond habitLogsOf's window: whether it has
// any at all, and whether anyone besides the owner has ever logged it (see isSharedHabit).
export async function habitLogPresenceOf(userId: string, habitId: string) {
  const { habit } = await getMembership(userId, habitId);
  const [anyLog, otherPersonLog] = await Promise.all([
    prisma.habitLog.findFirst({ where: { habitId }, select: { id: true } }),
    prisma.habitLog.findFirst({ where: { habitId, userId: { not: habit.userId } }, select: { id: true } }),
  ]);
  return { hasLogs: !!anyLog, hasLogsFromOthers: !!otherPersonLog };
}
