import { authenticateApiRequest } from '@/lib/apiKeys';
import { apiError, loggedEntry, readLogBody, smartLogBody } from '@/lib/apiRequests';
import { interpretInput, logFromInput, type HabitCandidate } from '@/app/actions/smartEntry';

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
  const { body: { text }, createdAt } = read;

  const interpretation = await interpretInput(auth.user, text);
  if (!interpretation.success) return apiError(interpretation.error, 422);
  const { candidates, confident, didIt } = interpretation;
  const guesses = { candidates: candidates.filter(c => c.habitId).map(({ habitId, name, probability }) => ({ habitId, name, probability })) };

  const [best] = candidates;
  if (!didIt) return apiError(`"${text}" doesn't read as something you did, so nothing was logged`, 422, guesses);
  if (!best?.habitId) return apiError(`"${text}" doesn't match any of your habits. Make one in the app first.`, 422, guesses);
  if (!confident) return apiError(`Not sure which habit "${text}" is about: ${describeCandidates(candidates)}. Say which, or log it through the habit's own URL.`, 422, guesses);

  const result = await logFromInput(auth.user, best.habitId, text, {}, createdAt);
  if (!result.success) return apiError(result.error, 422);
  if (!result.logged) return apiError(`${best.name}: ${result.problem}`, 422, { habit: { id: best.habitId, name: best.name }, values: result.data });
  return loggedEntry({ id: result.logId, createdAt: result.createdAt }, { id: best.habitId, name: best.name }, result.data);
}

// e.g. "Piano Practice or Ukulele"
function describeCandidates(candidates: HabitCandidate[]) {
  const names = candidates.filter(c => c.habitId).map(c => c.name);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : names[0] ?? 'none of them';
}
