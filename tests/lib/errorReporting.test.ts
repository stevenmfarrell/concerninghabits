import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { errorReportingConfig, reportable, withReminderMonitor } from '@/lib/errorReporting';
import { scrubEvent, scrubUrl } from '@/lib/errorScrubbing';
import { version } from '../../package.json';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('errorReportingConfig', () => {
  it('sends nothing unless SENTRY_DSN is set', () => {
    vi.stubEnv('SENTRY_DSN', '');
    expect(errorReportingConfig()).toBeNull();
  });

  it('reports as production unless told otherwise, with the app\'s version', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@example.ingest.sentry.io/1');
    vi.stubEnv('SENTRY_ENVIRONMENT', '');
    expect(errorReportingConfig()).toEqual({
      dsn: 'https://key@example.ingest.sentry.io/1',
      environment: 'production',
      release: `concerning-habits@${version}`,
    });

    vi.stubEnv('SENTRY_ENVIRONMENT', 'staging');
    expect(errorReportingConfig()?.environment).toBe('staging');
  });
});

describe('withReminderMonitor', () => {
  it('just runs the check without a DSN or a monitor', async () => {
    vi.stubEnv('SENTRY_DSN', '');
    vi.stubEnv('SENTRY_REMINDER_MONITOR', 'reminders');
    await expect(withReminderMonitor(async () => 'done')).resolves.toBe('done');

    vi.stubEnv('SENTRY_DSN', 'https://key@example.ingest.sentry.io/1');
    vi.stubEnv('SENTRY_REMINDER_MONITOR', '');
    await expect(withReminderMonitor(async () => 'done')).resolves.toBe('done');
  });
});

describe('reportable', () => {
  it('reports an AI SDK error by its kind and status, never its message', () => {
    const error = Object.assign(new Error('Type validation failed: Value: {"miles":"ran 3 miles with Sam"}'), {
      name: 'AI_TypeValidationError',
      statusCode: 400,
    });
    const safe = reportable(error) as Error;
    expect(safe.name).toBe('AI_TypeValidationError');
    expect(safe.message).toBe('AI_TypeValidationError (400)');
    expect(safe.stack).not.toContain('Sam');
    expect(safe.stack).toMatch(/\n\s+at /);
  });

  it('leaves any other error as it is', () => {
    const error = new Error('database is locked');
    expect(reportable(error)).toBe(error);
    expect(reportable('a string')).toBe('a string');
  });
});

describe('scrubUrl', () => {
  it('drops the query and fragment, and an invite\'s token', () => {
    expect(scrubUrl('https://app.example.com/habits/abc?code=secret#top')).toBe('https://app.example.com/habits/abc');
    expect(scrubUrl('/invite/s3cr3t-token')).toBe('/invite/[token]');
    expect(scrubUrl('https://app.example.com/invite/s3cr3t?x=1')).toBe('https://app.example.com/invite/[token]');
  });
});

describe('scrubEvent', () => {
  it('keeps only where and how something broke', () => {
    const event = {
      type: undefined,
      request: { method: 'POST', url: 'https://app.example.com/invite/tok?a=1', headers: { cookie: 'session=1' }, data: '{"text":"ran"}', cookies: { session: '1' } },
      user: { id: 'u1', ip_address: '1.2.3.4' },
      transaction: 'GET /invite/tok',
      contexts: { nextjs: { request_path: '/invite/tok?a=1', router_path: '/invite/[token]' } },
      breadcrumbs: [{ category: 'fetch', data: { url: '/api/log?key=abc', method: 'POST' } }, { category: 'navigation', data: { from: '/invite/tok', to: '/' } }],
    } as ErrorEvent;

    expect(scrubEvent(event)).toEqual({
      type: undefined,
      request: { method: 'POST', url: 'https://app.example.com/invite/[token]' },
      transaction: 'GET /invite/[token]',
      contexts: { nextjs: { request_path: '/invite/[token]', router_path: '/invite/[token]' } },
      breadcrumbs: [{ category: 'fetch', data: { url: '/api/log', method: 'POST' } }, { category: 'navigation', data: { from: '/invite/[token]', to: '/' } }],
    });
  });
});
