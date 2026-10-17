import { expect, test } from '@playwright/test';
import { db, makeHabit, openWithServiceWorker, ringFor, signIn } from './helpers';

// What the app does without a connection (see src/lib/offline and public/sw.js): changes wait in
// the outbox and are sent once it's back, and pages already visited open from the service worker.

test.afterAll(() => db.$disconnect());

test('an entry logged offline waits, then reaches the server once back online, at the time it was made', async ({ page, context, baseURL }) => {
  const user = await signIn(context, baseURL!);
  const habit = await makeHabit(user.id, 'Stretch');
  await openWithServiceWorker(page, '/');
  const ring = await ringFor(page, 'Stretch');

  await context.setOffline(true);
  const tappedAt = Date.now();
  await ring.click();
  await expect(page.getByText('Offline · 1 waiting')).toBeVisible();
  expect(await db.habitLog.count({ where: { habitId: habit.id } })).toBe(0);

  // Long enough offline that the time it reaches the server isn't the time it was made
  await page.waitForTimeout(1500);
  await context.setOffline(false);
  await expect.poll(() => db.habitLog.count({ where: { habitId: habit.id } }), { timeout: 15_000 }).toBe(1);
  await expect(page.getByText(/waiting|Syncing/)).toBeHidden();

  const log = await db.habitLog.findFirstOrThrow({ where: { habitId: habit.id } });
  expect(log.userId).toBe(user.id);
  expect(Math.abs(log.createdAt.getTime() - tappedAt)).toBeLessThan(1000);
});

test('an entry kept offline survives the page being closed, and is sent when the app opens again', async ({ page, context, baseURL }) => {
  const user = await signIn(context, baseURL!);
  const habit = await makeHabit(user.id, 'Floss');
  await openWithServiceWorker(page, '/');
  const ring = await ringFor(page, 'Floss');

  await context.setOffline(true);
  await ring.click();
  await expect(page.getByText('Offline · 1 waiting')).toBeVisible();
  await page.close();

  await context.setOffline(false);
  const reopened = await context.newPage();
  await reopened.goto('/');
  await expect.poll(() => db.habitLog.count({ where: { habitId: habit.id } }), { timeout: 15_000 }).toBe(1);
});

test('a change the server turns down is kept as couldn\'t sync, not dropped', async ({ page, context, baseURL }) => {
  const user = await signIn(context, baseURL!);
  const habit = await makeHabit(user.id, 'Journal');
  await openWithServiceWorker(page, '/');
  const ring = await ringFor(page, 'Journal');

  await context.setOffline(true);
  await ring.click();
  await expect(page.getByText('Offline · 1 waiting')).toBeVisible();

  // Deleted elsewhere meanwhile
  await db.habit.delete({ where: { id: habit.id } });
  await context.setOffline(false);
  await expect(page.getByText('1 couldn\'t sync')).toBeVisible({ timeout: 15_000 });
});

test('pages already visited open offline from the service worker', async ({ page, context, baseURL }) => {
  await signIn(context, baseURL!);
  await openWithServiceWorker(page, '/');
  await page.goto('/habits');
  const heading = page.getByRole('heading', { name: 'Habits', level: 1 });
  await expect(heading).toBeVisible();

  await context.setOffline(true);
  const response = await page.goto('/habits');
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(heading).toBeVisible();

  // A page never opened on this device shows the offline notice instead
  const unvisited = await page.goto('/settings/backup');
  expect(unvisited?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole('heading', { name: 'You\'re offline' })).toBeVisible();
});
