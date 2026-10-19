import * as Sentry from '@sentry/nextjs';

// Runs once when the server starts (see Next's instrumentation docs)
export async function register() {
  // Only in Node: the Edge runtime has no process to stop, and reminders need web-push and Prisma
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // First, so a problem in what follows is reported too (when SENTRY_DSN is set)
    const { startErrorReporting } = await import('./lib/errorReporting');
    startErrorReporting();

    // A mistyped DEPLOYMENT_MODE, or the hosted version without its sign-in settings, stops the
    // server, so it fails to start (and a host rolls back the deploy) rather than running and
    // answering every request with an error, or with no way to sign in
    const { deploymentProblem } = await import('./lib/deployment');
    const problem = deploymentProblem();
    if (problem) {
      console.error(problem);
      process.exit(1);
    }

    const { enableWriteAheadLog } = await import('./lib/database');
    await enableWriteAheadLog();

    // One reminder scheduler per server process (it keeps itself to one across a dev server's
    // reloads). Two servers on the same database, as for a moment during a deploy, are safe: neither
    // sends a reminder the other has (see claim in reminderScheduler.ts). More than that isn't
    // supported: the database is SQLite, a file one machine has, so the app, self-hosted or hosted,
    // runs as a single instance. Spreading it over several would need a shared database and a job
    // queue for reminders.
    const { startReminderScheduler } = await import('./lib/reminderScheduler');
    startReminderScheduler();
  }
}

// Reports an error thrown while handling a request (a page, a route, a server action) to Sentry. Does
// nothing unless startErrorReporting started it.
export const onRequestError = Sentry.captureRequestError;
