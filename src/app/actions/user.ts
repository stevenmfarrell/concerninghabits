'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { cache } from 'react';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { userPreferencesSchema } from '@/lib/preferences';
import { TIMEZONE_COOKIE, isValidTimeZone } from '@/lib/timezone';
import { assignUserColors } from '@/lib/userColors';
import { cookies, headers } from 'next/headers';
import { RETURN_TO_HEADER, withReturnTo } from '@/lib/returnTo';
import { revalidateLists } from './internal';
import { connectedIds, disconnect } from '@/lib/connections';
import { z } from 'zod';

export async function getDefaultUser(allowNeedsUpdate = false) {
  return getRequestUser(allowNeedsUpdate);
}

// Memoized per request, since every action a page calls starts with getDefaultUser. Kept separate
// because a 'use server' file may only export async functions, not the function cache() returns.
const getRequestUser = cache(async (allowNeedsUpdate: boolean) => {
  const session = await verifySession();
  
  if (!session?.userId) {
    redirect(withReturnTo('/api/logout', (await headers()).get(RETURN_TO_HEADER)));
  }

  // The user record is passed to client components, so never include the password hash. With their
  // vacations, on whose days everything of theirs counts as skipped (see CadenceUser).
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { categories: true, vacations: { select: { from: true, to: true } } },
    omit: { passwordHash: true }
  });

  if (!user) {
    redirect('/api/logout');
  }

  if (user.passwordNeedsUpdate && !allowNeedsUpdate) {
    redirect('/update-password');
  }

  // Kept on the user too, for reminders, which are sent with no request to read it from. Only
  // written when the browser reports a different one (e.g. after traveling).
  const reported = await getReportedTimeZone();
  if (reported && reported !== user.timeZone) {
    await prisma.user.update({ where: { id: user.id }, data: { timeZone: reported } });
  }

  return { ...user, timeZone: reported ?? Intl.DateTimeFormat().resolvedOptions().timeZone };
});

// The viewer's time zone, reported by the browser in a cookie (see TimeZoneSync), or null until
// the browser has reported it, when pages fall back to the server's time zone
async function getReportedTimeZone() {
  const timeZone = (await cookies()).get(TIMEZONE_COOKIE)?.value;
  return isValidTimeZone(timeZone) ? timeZone : null;
}

export async function updateUserPreferences(prefs: { bedtime?: string, weekStartsOn?: string, useEmojiTitle?: boolean, unitSystem?: string, emojiModifier?: string | null }) {
  const user = await getDefaultUser();
  // Server action arguments come straight from the client; only allow known preference fields
  const data = userPreferencesSchema.parse(prefs);
  await prisma.user.update({
    where: { id: user.id },
    data
  });
  revalidatePath('/settings');
  revalidateLists();
}

// Everyone whose name the current user can see, with their display color as the current user sees
// it (green for themselves), in account creation order: the people they're connected to (everyone,
// on a self-hosted server; see connections.ts), and anyone else on a habit they're in (e.g. someone
// else the habit's owner shared it with). Anyone else who logged entries they can see shows as a
// former member (see PersonLabel).
export async function getPeople() {
  const user = await getDefaultUser();
  const [connected, coMembers] = await Promise.all([
    connectedIds(user.id),
    prisma.habitMember.findMany({
      where: { habit: { members: { some: { userId: user.id } } }, userId: { not: user.id } },
      select: { userId: true },
    }),
  ]);
  const ids = [...new Set([user.id, ...connected, ...coMembers.map(m => m.userId)])];
  // Sorted here rather than with orderBy: Prisma splits a long `in` list into several queries for
  // SQLite, and combining that with orderBy crashes its query engine
  const users = (await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, createdAt: true } }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  return assignUserColors(users.map(({ id, name }) => ({ id, name })), user.id);
}

// The people the current user can share habits with (see connections.ts), in account creation order
export async function getConnectedIds() {
  return connectedIds((await getDefaultUser()).id);
}

// Disconnects the current user from someone on the hosted version (Settings → People): they stop
// seeing each other, and come off the habits they'd shared with each other (see disconnect)
export async function removeConnection(otherId: string) {
  const user = await getDefaultUser();
  await disconnect(user.id, z.string().parse(otherId));
  revalidateLists();
  revalidatePath('/settings/people');
}
