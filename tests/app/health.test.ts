import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { GET as health } from '@/app/api/health/route';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/health', () => {
  it('is ok when the database can be read', async () => {
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('answers 503, without the error, when it can\'t', async () => {
    vi.spyOn(prisma.appSetting, 'findFirst').mockRejectedValue(new Error('SQLITE_CANTOPEN: /app/data/concerning_habits.db'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await health();
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ status: 'error' });
    expect(text).not.toContain('SQLITE');
  });
});
