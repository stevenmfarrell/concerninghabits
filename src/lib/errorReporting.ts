import * as Sentry from '@sentry/nextjs';
import { version } from '../../package.json';
import { PRIVATE_OPTIONS } from './errorScrubbing';

// Sends the server's errors, and the browser's (see ErrorReporting.tsx), to Sentry when SENTRY_DSN
// is set, as it is for the hosted version. Without it nothing is sent anywhere, so a self-hosted
// server reports nothing unless its owner sets up a Sentry project of their own. Server-only.

export interface ErrorReportingConfig {
  dsn: string;
  environment: string;
  release: string;
}

// Where reports go, or null when they aren't sent. SENTRY_ENVIRONMENT tells the hosted version's
// production and staging apart (Sentry's default is "production").
export function errorReportingConfig(): ErrorReportingConfig | null {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return null;
  return { dsn, environment: process.env.SENTRY_ENVIRONMENT?.trim() || 'production', release: `concerning-habits@${version}` };
}

// Starts reporting the server's errors, from src/instrumentation.ts. Errors only: no performance
// tracing, and nothing personal (see PRIVATE_OPTIONS).
export function startErrorReporting() {
  const config = errorReportingConfig();
  if (!config) return;
  Sentry.init({ ...config, ...PRIVATE_OPTIONS });
}

// For an error that's caught and handled, so it never reaches Next's onRequestError (see
// src/instrumentation.ts) but still means something is broken: logs it, as before, and reports it.
// Sentry sends an error's message and stack, not its other properties.
export function reportError(message: string, error: unknown) {
  console.error(message, error);
  Sentry.captureException(reportable(error), { extra: { message } });
}

// An AI SDK error (named AI_…) as it's reported: only its kind, its status for a failed request,
// and its stack. Its message can quote the request or the model's answer (a TypeValidationError's
// holds the value it rejected), with the user's own words, and so can the error it wraps.
export function reportable(error: unknown): unknown {
  if (!(error instanceof Error) || !error.name.startsWith('AI_')) return error;
  const status = (error as { statusCode?: unknown }).statusCode;
  const safe = new Error(typeof status === 'number' ? `${error.name} (${status})` : error.name);
  safe.name = error.name;
  const frames = (error.stack ?? '').split('\n').filter(line => /^\s+at /.test(line));
  safe.stack = [`${safe.name}: ${safe.message}`, ...frames].join('\n');
  return safe;
}

// Runs one of the reminder scheduler's checks under a Sentry cron monitor, when
// SENTRY_REMINDER_MONITOR names one, so Sentry raises an alert when checks stop coming in (the
// server is down or the scheduler has stopped) or fail. Set it only where the server always runs:
// a server that stops when idle, as the hosted staging app does, would raise an alert every time.
export function withReminderMonitor<T>(check: () => Promise<T>): Promise<T> {
  const slug = process.env.SENTRY_REMINDER_MONITOR?.trim();
  if (!slug || !errorReportingConfig()) return check();
  return Sentry.withMonitor(slug, check, {
    schedule: { type: 'interval', value: 1, unit: 'minute' },
    // Minutes a check may be late, or take, before it counts as missed or failed
    checkinMargin: 5,
    maxRuntime: 5,
    // A deploy's restart misses a check or two, so alert after a few in a row
    failureIssueThreshold: 3,
    recoveryThreshold: 1,
  });
}
