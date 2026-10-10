// Runs once when the server starts (see Next's instrumentation docs)
export async function register() {
  // Reminders need Node (web-push, Prisma), and only one copy should run
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startReminderScheduler } = await import('./lib/reminderScheduler');
    startReminderScheduler();
  }
}
