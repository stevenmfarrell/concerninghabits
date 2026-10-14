// Runs once when the server starts (see Next's instrumentation docs)
export async function register() {
  // Only in Node: the Edge runtime has no process to stop, and reminders need web-push and Prisma
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // A mistyped DEPLOYMENT_MODE stops the server, so it fails to start (and a host rolls back the
    // deploy) rather than running and answering every request with an error
    const { deploymentMode } = await import('./lib/deployment');
    try {
      deploymentMode();
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }

    // Only one copy of the reminder scheduler should run
    const { startReminderScheduler } = await import('./lib/reminderScheduler');
    startReminderScheduler();
  }
}
