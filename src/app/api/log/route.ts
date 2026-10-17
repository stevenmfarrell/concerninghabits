import { authenticateApiRequest } from '@/lib/apiKeys';
import { apiError, loggedEntry, readLogBody, smartLogBody } from '@/lib/apiRequests';
import { logToAnyHabit } from '@/lib/smartEntry';

// Logs something said or typed to whichever of the user's habits it's about, the way the dashboard's
// smart entry does, for another app: e.g. one shortcut that asks "What did you do?" for every habit.
// The body is JSON: {"text": "ran 3 miles in 25 min"}, with an optional "at" (an ISO 8601 date and
// time) for when it was done. It never makes a new habit, and when it can't tell which habit was
// meant, or it doesn't read as something done, it logs nothing and answers 422 with its best guesses
// (`candidates`) to log through a habit's own route instead.
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request, 'log');
  if (!auth.ok) return auth.response;

  const read = await readLogBody(request, smartLogBody);
  if (!read.ok) return read.response;

  const result = await logToAnyHabit(auth.user, read.body.text, read.createdAt);
  if (!result.logged) {
    return apiError(result.error, 422, {
      candidates: result.candidates.map(({ habitId, name, probability }) => ({ habitId, name, probability })),
      ...(result.habit ? { habit: result.habit } : {}),
      ...(result.data ? { values: result.data } : {}),
    });
  }
  return loggedEntry({ id: result.logId, createdAt: result.createdAt }, result.habit, result.data);
}
