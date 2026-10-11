'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { todayKeyFor } from '@/lib/timezone';
import { currentVacation, endVacation as endedVacation, vacationProblem } from '@/lib/vacation';
import { getDefaultUser } from './user';

// A vacation changes what's due, skipped and healthy everywhere
function revalidateEverything() {
  revalidatePath('/', 'layout');
}

// Ends `vacation` before civil day `day`, keeping its days up to then, or removes it if it hasn't
// started by then (see endVacation in lib/vacation)
async function endBefore(vacation: { id: string; from: string; to: string | null }, day: string) {
  const ended = endedVacation(vacation, day);
  if ('remove' in ended) await prisma.vacation.delete({ where: { id: vacation.id } });
  else await prisma.vacation.update({ where: { id: vacation.id }, data: { to: ended.to } });
}

// The vacation the current user is on, or the next one they've set, with today's date for showing
// it; null for neither
export async function getVacation() {
  const user = await getDefaultUser();
  const today = todayKeyFor(user);
  const vacations = await prisma.vacation.findMany({ where: { userId: user.id, OR: [{ to: null }, { to: { gte: today } }] }, select: { id: true, from: true, to: true } });
  const vacation = currentVacation(vacations, today);
  return vacation && { ...vacation, today };
}

// Sets the current user's vacation from `from` to `to` (civil day keys, `to` null for until they end
// it), replacing the one they're on or have coming up, if any
export async function setVacation(from: string, to: string | null) {
  const user = await getDefaultUser();
  const today = todayKeyFor(user);
  const problem = vacationProblem(from, to, today);
  if (problem) throw new Error(problem);

  const existing = await getVacation();
  // The one they're on keeps its days so far, and the new one picks up from its start; one coming up
  // is replaced outright
  if (existing?.active) await endBefore(existing, from);
  else if (existing) await prisma.vacation.delete({ where: { id: existing.id } });
  await prisma.vacation.create({ data: { userId: user.id, from, to } });
  revalidateEverything();
}

// Ends the current user's vacation today, keeping the days already taken, or calls off the one
// coming up
export async function endVacation() {
  const user = await getDefaultUser();
  const vacation = await getVacation();
  if (!vacation) return;
  await endBefore(vacation, todayKeyFor(user));
  revalidateEverything();
}
