import { MAX_AI_INPUT_LENGTH, MAX_AI_REQUESTS_PER_HOUR } from './constants';
import { isCloud } from './deployment';
import { hasAi } from './plans';
import { prisma } from './prisma';
import { countRequest } from './rateLimit';

const WINDOW_MS = 60 * 60 * 1000;

// What the user's told when their plan doesn't include AI (see plans.ts)
export const AI_NOT_IN_PLAN = 'AI features are part of the paid plan, and your free trial has ended. See Settings → Plan.';

// Why an AI request can't be made, or null when it can, in which case it counts toward the user's
// hourly limit. `inputs` are what the user typed or said; anything else sent along (a form, a
// chart) is checked by the caller. Server-only: the actions that make AI requests call this first.
export async function aiRequestProblem(userId: string, ...inputs: (string | null | undefined)[]): Promise<string | null> {
  if (inputs.some(input => typeof input === 'string' && input.length > MAX_AI_INPUT_LENGTH)) {
    return `That's too long. Keep it under ${MAX_AI_INPUT_LENGTH} characters.`;
  }

  // Only the hosted version has plans, so a self-hosted server skips looking the user up
  if (isCloud()) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { trialEndsAt: true, paidUntil: true } });
    if (!user || !hasAi(user)) return AI_NOT_IN_PLAN;
  }

  // Shares the login limiter's table, under its own identifier per user
  if (!(await countRequest(`ai:${userId}`, MAX_AI_REQUESTS_PER_HOUR, WINDOW_MS))) {
    return 'You\'ve made a lot of AI requests. Try again in a little while.';
  }
  return null;
}
