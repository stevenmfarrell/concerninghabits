import { prisma } from './prisma';

// The client's address, for keying rate limits. A reverse proxy appends the address it saw to
// X-Forwarded-For, so the last entry is the most trustworthy.
export function clientIp(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',').map(ip => ip.trim()).filter(Boolean);
  return forwardedFor?.at(-1) ?? headers.get('x-real-ip') ?? 'unknown';
}

// Counts a request under `identifier` (in the RateLimit table, which the login limiter uses too),
// and says whether it's allowed: no more than `max` of them in a window of `windowMs`, which starts
// at the first. Server-only.
export async function countRequest(identifier: string, max: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const limit = await prisma.rateLimit.findUnique({ where: { identifier } });
  if (limit && limit.resetTime >= now) {
    if (limit.count >= max) return false;
    await prisma.rateLimit.update({ where: { identifier }, data: { count: { increment: 1 } } });
  } else {
    const resetTime = new Date(now.getTime() + windowMs);
    await prisma.rateLimit.upsert({ where: { identifier }, create: { identifier, count: 1, resetTime }, update: { count: 1, resetTime } });
  }
  return true;
}
