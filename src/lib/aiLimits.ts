import { MAX_AI_INPUT_LENGTH, MAX_AI_REQUESTS_PER_HOUR } from './constants';
import { countRequest } from './rateLimit';

const WINDOW_MS = 60 * 60 * 1000;

// Why an AI request can't be made, or null when it can, in which case it counts toward the user's
// hourly limit. `inputs` are what the user typed or said; anything else sent along (a form, a
// chart) is checked by the caller. Server-only: the actions that make AI requests call this first.
export async function aiRequestProblem(userId: string, ...inputs: (string | null | undefined)[]): Promise<string | null> {
  if (inputs.some(input => typeof input === 'string' && input.length > MAX_AI_INPUT_LENGTH)) {
    return `That's too long. Keep it under ${MAX_AI_INPUT_LENGTH} characters.`;
  }

  // Shares the login limiter's table, under its own identifier per user
  if (!(await countRequest(`ai:${userId}`, MAX_AI_REQUESTS_PER_HOUR, WINDOW_MS))) {
    return 'You\'ve made a lot of AI requests. Try again in a little while.';
  }
  return null;
}
