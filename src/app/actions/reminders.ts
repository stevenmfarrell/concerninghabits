'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getVapidKeys, REMINDER_TAG, sendPush } from '@/lib/push';
import { habitReminderStatus } from '@/lib/reminderScheduler';
import { isValidTimeZone } from '@/lib/timezone';
import { getDefaultUser } from './user';

// The key a browser needs to subscribe to this server's push messages
export async function getPushPublicKey() {
  await getDefaultUser();
  return (await getVapidKeys()).publicKey;
}

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(200) }),
});

// Saves this browser's push subscription for the current user, along with its time zone, which the
// reminders are timed by. An endpoint belongs to one browser, so if someone else had signed in on
// it before, it moves to whoever turned reminders on.
export async function savePushSubscription(subscription: unknown, timeZone: string) {
  const user = await getDefaultUser();
  const { endpoint, keys } = subscriptionSchema.parse(subscription);
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
  });
  if (isValidTimeZone(timeZone)) await prisma.user.update({ where: { id: user.id }, data: { timeZone } });
}

export async function removePushSubscription(endpoint: string) {
  const user = await getDefaultUser();
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
}

// Whether the current user has this browser's subscription (it may have been someone else's, or
// forgotten after the push service rejected it)
export async function hasPushSubscription(endpoint: string) {
  const user = await getDefaultUser();
  return (await prisma.pushSubscription.count({ where: { endpoint, userId: user.id } })) > 0;
}

export async function sendTestReminder() {
  const user = await getDefaultUser();
  const delivered = await sendPush(user.id, {
    title: 'Reminders are on',
    body: "You'll hear from us only when you're running late on a habit.",
    url: '/settings/reminders',
    tag: `${REMINDER_TAG}-test`,
  });
  if (!delivered) throw new Error("Couldn't reach this device. Try turning reminders off and on again.");
}

// Turns the current user's reminder for a habit on or off, at a time they set ("HH:MM") or, with
// null, whenever they're running late by their usual time. Turning it on also resumes a reminder
// that was paused for going unanswered.
export async function setHabitReminder(habitId: string, enabled: boolean, remindAt: string | null) {
  const user = await getDefaultUser();
  const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().parse(remindAt);
  const membership = await prisma.habitMember.findUnique({ where: { habitId_userId: { habitId, userId: user.id } } });
  if (!membership) throw new Error('Unauthorized');
  await prisma.habitMember.update({
    where: { habitId_userId: { habitId, userId: user.id } },
    data: { remind: enabled, remindAt: time, remindMutedAt: null },
  });
  revalidatePath(`/log/${habitId}`);
  revalidatePath(`/edit/${habitId}`);
  revalidatePath('/settings/reminders');
}

// The current user's reminder for a habit, for its page, and whether any of their devices get
// reminders. Null if they can't see the habit.
export async function getHabitReminder(habitId: string) {
  const user = await getDefaultUser();
  const [status, devices] = await Promise.all([
    habitReminderStatus(habitId, user),
    prisma.pushSubscription.count({ where: { userId: user.id } }),
  ]);
  return status && { status, hasDevice: devices > 0 };
}

// Whether any of the current user's devices get reminders, for a new habit's reminder settings
// (an existing habit's come with getHabitReminder)
export async function hasReminderDevice() {
  const user = await getDefaultUser();
  return (await prisma.pushSubscription.count({ where: { userId: user.id } })) > 0;
}

// Every habit the current user has a reminder on for, with how each is doing, for Settings
export async function getReminderOverview() {
  const user = await getDefaultUser();
  const memberships = await prisma.habitMember.findMany({
    where: { userId: user.id, remind: true },
    select: { habit: { select: { id: true, name: true } } },
    orderBy: { habit: { name: 'asc' } },
  });
  const habits = await Promise.all(memberships.map(async ({ habit }) => ({ ...habit, status: (await habitReminderStatus(habit.id, user))! })));
  return { habits, bedtime: user.bedtime };
}
