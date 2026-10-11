'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { civilDayKey, parseBedtimeOffsetMinutes, toCivilDate } from '@/lib/timezone';
import { currentVacation, endVacation as endedVacation, vacationProblem } from '@/lib/vacation';
import { getDefaultUser } from './db';

// Today for the user, as a civil day key (their time zone, with their bedtime ending the day)
function todayKey(user: { timeZone: string; bedtime: string }) {
  return civilDayKey(toCivilDate(new Date(), user.timeZone, parseBedtimeOffsetMinutes(user.bedtime)));
}

// A vacation changes what's due, skipped and healthy everywhere
function revalidateEverything() {
  revalidatePath('/', 'layout');
}

// The vacation the current user is on, or the next one they've set, with today's date for showing
// it; null for neither
export async function getVacation() {
  const user = await getDefaultUser();
  const today = todayKey(user);
  const vacations = await prisma.vacation.findMany({ where: { userId: user.id, OR: [{ to: null }, { to: { gte: today } }] }, select: { id: true, from: true, to: true } });
  const vacation = currentVacation(vacations, today);
  return vacation && { ...vacation, today };
}

// Sets the current user's vacation from `from` to `to` (civil day keys, `to` null for until they end
// it), replacing the one they're on or have coming up, if any
export async function setVacation(from: string, to: string | null) {
  const user = await getDefaultUser();
  const today = todayKey(user);
  const problem = vacationProblem(from, to, today);
  if (problem) throw new Error(problem);

  const existing = await getVacation();
  if (existing?.active) {
    // Its days so far stay taken; the new one picks up from its start
    const ended = endedVacation(existing, from);
    if ('remove' in ended) await prisma.vacation.delete({ where: { id: existing.id } });
    else await prisma.vacation.update({ where: { id: existing.id }, data: { to: ended.to } });
  } else if (existing) {
    await prisma.vacation.delete({ where: { id: existing.id } });
  }
  await prisma.vacation.create({ data: { userId: user.id, from, to } });
  revalidateEverything();
}

// Ends the current user's vacation today, keeping the days already taken, or calls off the one
// coming up
export async function endVacation() {
  const user = await getDefaultUser();
  const vacation = await getVacation();
  if (!vacation) return;
  const ended = endedVacation(vacation, todayKey(user));
  if ('remove' in ended) await prisma.vacation.delete({ where: { id: vacation.id } });
  else await prisma.vacation.update({ where: { id: vacation.id }, data: { to: ended.to } });
  revalidateEverything();
}
