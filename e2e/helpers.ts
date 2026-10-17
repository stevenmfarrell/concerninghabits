import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { expect, type BrowserContext, type Page } from '@playwright/test';

// The database the server under test uses (see scripts/e2e-server.mjs), for setting up what a test
// needs and checking what reached the server
export const db = new PrismaClient({ datasourceUrl: `file:${path.resolve(__dirname, '..', 'prisma', 'e2e.db')}` });

// A user signed in on `context`, with a session made straight in the database rather than by
// typing a password into the sign-in page, which these tests aren't about
export async function signIn(context: BrowserContext, baseURL: string) {
  const user = await db.user.create({ data: { name: 'Tester', email: `tester-${crypto.randomUUID()}@example.test` } });
  const session = await db.session.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  await context.addCookies([{ name: 'session', value: session.id, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
  return user;
}

// A habit of the user's with nothing to fill in, done once a day, so a tap on its ring logs it
export async function makeHabit(userId: string, name: string) {
  const habit = await db.habit.create({ data: { name, schema: '{"type":"object","properties":{}}', userId } });
  await db.habitMember.create({ data: { habitId: habit.id, userId } });
  return habit;
}

// Opens `path` with the service worker in charge of the page, so what it keeps for offline is kept.
// The first load registers it; it takes over open pages once active (clients.claim), keeping them.
export async function openWithServiceWorker(page: Page, path: string) {
  await page.goto(path);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

// What the page shows once it's alive (hydrated), rather than only drawn: until then a tap on the
// ring does nothing
export async function ringFor(page: Page, habitName: string) {
  const ring = page.getByRole('button', { name: new RegExp(`^Log ${habitName}`) });
  await expect(ring).toBeVisible();
  return ring;
}
