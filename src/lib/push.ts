import webpush from 'web-push';
import { prisma } from './prisma';
import { appUrl, isCloud } from './deployment';
import { reportError } from './errorReporting';

// Web Push, for reminders. Push services only accept messages signed with the server's VAPID key
// pair, which is set with VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, or else generated on first use
// and kept in the database, so a self-hosted instance needs no setup. (Changing the keys
// invalidates every subscription, so each device has to turn reminders on again.)

const VAPID_SETTING = 'vapidKeys';

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let cachedKeys: Promise<VapidKeys> | null = null;

export function getVapidKeys() {
  cachedKeys ??= loadVapidKeys().catch(error => {
    cachedKeys = null;
    throw error;
  });
  return cachedKeys;
}

async function loadVapidKeys(): Promise<VapidKeys> {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey } = process.env;
  if (publicKey && privateKey) return { publicKey, privateKey };

  const stored = await prisma.appSetting.findUnique({ where: { key: VAPID_SETTING } });
  if (stored) return JSON.parse(stored.value);

  const generated = webpush.generateVAPIDKeys();
  // Upserted with no update, so if two requests race to generate keys, both use the first one saved
  const saved = await prisma.appSetting.upsert({
    where: { key: VAPID_SETTING },
    create: { key: VAPID_SETTING, value: JSON.stringify(generated) },
    update: {},
  });
  return JSON.parse(saved.value);
}

// Who push services can contact about this server's messages: VAPID_SUBJECT, or else the first
// admin's email, or on the hosted version, which has no admin, its https address (web-push refuses
// any other kind). Apple's push service rejects messages without a real-looking one.
async function vapidSubject() {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  if (isCloud() && appUrl().startsWith('https://')) return appUrl();
  const admin = await prisma.user.findFirst({ where: { isAdmin: true }, orderBy: { createdAt: 'asc' }, select: { email: true } });
  return `mailto:${admin?.email ?? 'admin@example.com'}`;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  // Notifications with the same tag replace each other, so there's never more than one waiting
  tag?: string;
  // Set for a habit that can be logged from the notification (one with no fields to fill in)
  habitId?: string;
}

export const REMINDER_TAG = 'habit-reminder';

// Sends to every device the user turned reminders on for, and forgets any the push service says
// are gone (the user turned off notifications, or uninstalled the app). Whether at least one got it.
export async function sendPush(userId: string, payload: PushPayload) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return false;

  const keys = await getVapidKeys();
  const options = { vapidDetails: { subject: await vapidSubject(), ...keys }, TTL: 60 * 60 };
  const body = JSON.stringify({ tag: REMINDER_TAG, ...payload });

  const results = await Promise.all(subscriptions.map(async subscription => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, body, options);
      return true;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
      } else {
        reportError(`Push failed (${status})`, error);
      }
      return false;
    }
  }));
  return results.some(Boolean);
}
