import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

// The client's address, for keying rate limits. A reverse proxy appends the address it saw to
// X-Forwarded-For, so behind one, the last entry is the client's. Without one, it can't be trusted:
// Next only fills the header in from the connection when the request didn't bring its own
// (base-server.js, `??=`), and gives the app no other way to see the connection's address. So a
// client talking to the app directly can claim any address, and limits keyed by it are only a
// convenience; the ones that matter (e.g. login's per-email limit) can't depend on it.
export function clientIp(headers: Headers) {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',').map(ip => ip.trim()).filter(Boolean);
  return forwardedFor?.at(-1) ?? headers.get('x-real-ip') ?? 'unknown';
}

// Counts a request under `identifier` (in the RateLimit table, which the login limiter uses too),
// and says whether it's allowed: no more than `max` of them in a window of `windowMs`, which starts
// at the first. Each step is a single statement that only succeeds if there's still room, so
// requests arriving together can't all see room for one more and all go ahead. Server-only.
export async function countRequest(identifier: string, max: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const resetTime = new Date(now.getTime() + windowMs);
  // Only goes round again when another request made or restarted the window meanwhile
  for (let attempt = 0; attempt < 3; attempt++) {
    const counted = await prisma.rateLimit.updateMany({ where: { identifier, resetTime: { gte: now }, count: { lt: max } }, data: { count: { increment: 1 } } });
    if (counted.count > 0) return true;
    // A window that's over starts again with this request
    const restarted = await prisma.rateLimit.updateMany({ where: { identifier, resetTime: { lt: now } }, data: { count: 1, resetTime } });
    if (restarted.count > 0) return true;
    const limit = await prisma.rateLimit.findUnique({ where: { identifier } });
    if (limit) {
      if (limit.resetTime >= now && limit.count >= max) return false;
      continue;
    }
    try {
      await prisma.rateLimit.create({ data: { identifier, count: 1, resetTime } });
      return true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
  }
  return false;
}

// Gives back a request counted by countRequest that turned out not to count (e.g. a login that
// succeeded, when only failures are limited)
export async function uncountRequest(identifier: string) {
  await prisma.rateLimit.updateMany({ where: { identifier, count: { gt: 0 } }, data: { count: { decrement: 1 } } });
}
