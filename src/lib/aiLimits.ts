import { prisma } from './prisma';
import { MAX_AI_INPUT_LENGTH, MAX_AI_REQUESTS_PER_HOUR } from './constants';

const WINDOW_MS = 60 * 60 * 1000;

// Why an AI request can't be made, or null when it can, in which case it counts toward the user's
// hourly limit. `inputs` are what the user typed or said; anything else sent along (a form, a
// chart) is checked by the caller. Server-only: the actions that make AI requests call this first.
export async function aiRequestProblem(userId: string, ...inputs: (string | null | undefined)[]): Promise<string | null> {
  if (inputs.some(input => typeof input === 'string' && input.length > MAX_AI_INPUT_LENGTH)) {
    return `That's too long. Keep it under ${MAX_AI_INPUT_LENGTH} characters.`;
  }

  // Shares the login limiter's table, under its own identifier per user
  const identifier = `ai:${userId}`;
  const now = new Date();
  const limit = await prisma.rateLimit.findUnique({ where: { identifier } });
  if (limit && limit.resetTime >= now) {
    if (limit.count >= MAX_AI_REQUESTS_PER_HOUR) return 'You\'ve made a lot of AI requests. Try again in a little while.';
    await prisma.rateLimit.update({ where: { identifier }, data: { count: { increment: 1 } } });
  } else {
    const resetTime = new Date(now.getTime() + WINDOW_MS);
    await prisma.rateLimit.upsert({ where: { identifier }, create: { identifier, count: 1, resetTime }, update: { count: 1, resetTime } });
  }
  return null;
}
