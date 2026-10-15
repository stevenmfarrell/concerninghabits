import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { evaluate, parseCadence } from './cadence';
import { fieldsOf } from './formFields';
import { parseHabitSchema } from './habitSchema';
import { civilDateFor, civilDayKey, DAY_MS, isValidTimeZone, todayKeyFor } from './timezone';
import { currentVacation } from './vacation';
import { dayMinute, learnUsualTime, nudgeTime, pickNudge, reminderMessage, shouldMute, usualTimeSamples, IGNORED_LIMIT, MAX_SAMPLES, type Candidate, type DayProgress, type LearnedTime } from './reminders';
import { sendPush } from './push';

// Sends habit reminders (see reminders.ts for how it decides what and when). It runs in the server
// process, started from src/instrumentation.ts, checking every minute for users with a habit
// running late. More than one server on the same database (e.g. old and new during a deploy) never
// sends the same reminder twice (see claim), and a check missed while the server was down is made
// up by the next, which still finds the habit late.

const TICK_MS = 60_000;
// How far back to read a habit's entries to learn its usual time: enough for MAX_SAMPLES days of a
// daily habit, and for a weekly one to have a few
const LOOKBACK_DAYS = Math.max(MAX_SAMPLES * 3, 60);

interface ReminderUser {
  id: string;
  timeZone: string;
  bedtime: string;
  weekStartsOn: string;
}

// When the user's habit, with these entries (everyone's, for a shared one), runs late. A habit
// done several times a day is judged by when its next entry is usually logged, so it comes with how
// far along it is today. Once it's done for the day, that's its first entry, as it'll be tomorrow.
function learnedTimeFor(cadenceRaw: string, logDates: Date[], user: ReminderUser, now: Date): { learned: LearnedTime; progress: DayProgress | null } {
  const cadence = parseCadence(cadenceRaw);
  const today = evaluate(cadence, logDates, user, now).progress;
  const progress = today?.period === 'daily' ? { done: today.done < today.needed ? today.done : 0, needed: today.needed } : null;
  return { learned: learnUsualTime(usualTimeSamples(logDates, progress?.done ?? 0, user, now)), progress };
}

// A habit's reminder as its page shows it: whether it's on (and paused after going unanswered), the
// time the user set, and what was learned from its entries
export async function habitReminderStatus(habitId: string, user: ReminderUser, now = new Date()) {
  const membership = await prisma.habitMember.findUnique({
    where: { habitId_userId: { habitId, userId: user.id } },
    select: { remind: true, remindAt: true, remindMutedAt: true, habit: { select: { cadence: true } } },
  });
  if (!membership) return null;
  const logs = await prisma.habitLog.findMany({
    where: { habitId, createdAt: { gte: new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS) } },
    select: { createdAt: true },
  });
  const { learned, progress } = learnedTimeFor(membership.habit.cadence, logs.map(l => l.createdAt), user, now);
  return { enabled: membership.remind, remindAt: membership.remindAt, muted: !!membership.remindMutedAt, learned, progress };
}

// Which of the user's habits to nudge about right now (none, most of the time), with each
// reminder that's gone unanswered too often paused instead
export async function dueReminders(user: ReminderUser, now: Date): Promise<Candidate[]> {
  const today = todayKeyFor(user, now);

  // Nothing while they're on vacation; afterwards, its days count as skips, as on the Agenda
  const vacations = await prisma.vacation.findMany({ where: { userId: user.id, from: { lte: today } }, select: { from: true, to: true } });
  if (currentVacation(vacations, today)?.active) return [];
  const away = { ...user, vacations };

  const sentToday = await prisma.reminderSent.findMany({ where: { userId: user.id, day: today }, select: { habitId: true, sentAt: true } });
  const notificationsToday = new Set(sentToday.map(s => s.sentAt.getTime())).size;
  const mentionedToday = new Set(sentToday.map(s => s.habitId));

  const memberships = await prisma.habitMember.findMany({
    where: { userId: user.id, remind: true, remindMutedAt: null, habitId: { notIn: [...mentionedToday] } },
    select: { remindAt: true, habit: { select: { id: true, name: true, cadence: true } } },
  });
  if (memberships.length === 0) return [];

  const logs = await prisma.habitLog.findMany({
    where: { habitId: { in: memberships.map(m => m.habit.id) }, createdAt: { gte: new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS) } },
    select: { habitId: true, createdAt: true },
  });

  const skips = await prisma.habitSkip.findMany({
    where: { habitId: { in: memberships.map(m => m.habit.id) } },
    select: { habitId: true, day: true },
  });

  const candidates: Candidate[] = [];
  for (const { remindAt, habit } of memberships) {
    const cadence = parseCadence(habit.cadence);
    if (cadence.type === 'none') continue;
    const dates = logs.filter(l => l.habitId === habit.id).map(l => l.createdAt);
    const skippedDays = skips.filter(s => s.habitId === habit.id).map(s => s.day);
    // Only what the Agenda shows as due now: a weekly or monthly one only on its last day, and
    // nothing skipped or on a day off
    if (evaluate(cadence, dates, away, now, skippedDays).agenda.state !== 'due') continue;
    const { learned, progress } = learnedTimeFor(habit.cadence, dates, user, now);
    const { at, manual } = nudgeTime(remindAt, learned, user.bedtime);
    candidates.push({ habitId: habit.id, name: habit.name, at, manual, usual: learned.kind === 'learned' ? learned.usual : null, progress });
  }

  const picked = pickNudge(candidates, dayMinute(now, user.timeZone, user.bedtime), notificationsToday);
  const kept: Candidate[] = [];
  for (const candidate of picked) {
    if (await ignoredTooOften(user, candidate.habitId)) {
      await prisma.habitMember.update({ where: { habitId_userId: { habitId: candidate.habitId, userId: user.id } }, data: { remindMutedAt: now } });
    } else {
      kept.push(candidate);
    }
  }
  return kept;
}

// Whether the user's last IGNORED_LIMIT reminders about a habit all went unanswered: it wasn't
// logged (by anyone, for a shared habit) or skipped on the day each was sent
async function ignoredTooOften(user: ReminderUser, habitId: string) {
  const recent = await prisma.reminderSent.findMany({
    where: { userId: user.id, habitId },
    orderBy: { sentAt: 'desc' },
    take: IGNORED_LIMIT,
  });
  if (recent.length < IGNORED_LIMIT) return false;
  const since = new Date(recent[recent.length - 1].sentAt.getTime() - DAY_MS);
  const loggedDays = new Set(
    (await prisma.habitLog.findMany({ where: { habitId, createdAt: { gte: since } }, select: { createdAt: true } }))
      .map(l => civilDayKey(civilDateFor(l.createdAt, user))),
  );
  const skippedDays = new Set(
    (await prisma.habitSkip.findMany({ where: { habitId, day: { in: recent.map(r => r.day) } }, select: { day: true } })).map(s => s.day),
  );
  return shouldMute(recent.map(r => loggedDays.has(r.day) || skippedDays.has(r.day)));
}

// Sends each user what's due for them now, and records it so it isn't sent again today
export async function runReminderTick(now = new Date()) {
  const users = await prisma.user.findMany({
    where: {
      timeZone: { not: null },
      pushSubscriptions: { some: {} },
      habitMemberships: { some: { remind: true, remindMutedAt: null } },
    },
    select: { id: true, timeZone: true, bedtime: true, weekStartsOn: true },
  });

  for (const { timeZone, ...rest } of users) {
    if (!isValidTimeZone(timeZone)) continue;
    const user = { ...rest, timeZone };
    try {
      const habits = await dueReminders(user, now);
      if (habits.length === 0) continue;
      const habitIds = habits.map(h => h.habitId);
      const day = todayKeyFor(user, now);
      if (!(await claim(user.id, habitIds, day, now))) continue;
      // One with nothing to fill in can be logged straight from the notification
      const quickLog = habits.length === 1 && !(await hasForm(habitIds[0])) ? { habitId: habitIds[0] } : {};
      const delivered = await sendPush(user.id, { ...reminderMessage(habits, user.bedtime), ...quickLog });
      // Given back if no device got it, so it's tried again next tick
      if (!delivered) await unclaim(user.id, habitIds, day, now);
    } catch (error) {
      console.error(`Reminders failed for user ${user.id}`, error);
    }
  }
}

// Records a reminder as sent before it's sent, so it goes out once however many checks are running:
// a deploy can briefly run the new server alongside the old one, and each has its own scheduler.
// Each habit is reminded about at most once a day (ReminderSent's key), so whichever check records
// it first sends it, and another finds it taken and leaves it. All of a notification's habits are
// recorded together, or none are. A server stopped between recording and sending loses that one
// notification rather than sending it twice.
async function claim(userId: string, habitIds: string[], day: string, now: Date) {
  try {
    await prisma.reminderSent.createMany({ data: habitIds.map(habitId => ({ userId, habitId, day, sentAt: now })) });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
    throw error;
  }
}

// Takes back a claim (see claim) for a notification no device got
async function unclaim(userId: string, habitIds: string[], day: string, now: Date) {
  await prisma.reminderSent.deleteMany({ where: { userId, day, habitId: { in: habitIds }, sentAt: now } });
}

async function hasForm(habitId: string) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId }, select: { schema: true } });
  return Object.keys(fieldsOf(parseHabitSchema(habit?.schema))).length > 0;
}

// Starts the once-a-minute check. Kept on globalThis so a dev server's reloads don't start more.
export function startReminderScheduler() {
  const global = globalThis as unknown as { reminderScheduler?: NodeJS.Timeout };
  if (global.reminderScheduler) return;

  let running = false;
  global.reminderScheduler = setInterval(async () => {
    // A slow tick (e.g. a push service taking its time) isn't overlapped by the next one
    if (running) return;
    running = true;
    try {
      await runReminderTick();
    } catch (error) {
      console.error('Reminder check failed', error);
    } finally {
      running = false;
    }
  }, TICK_MS);
}
