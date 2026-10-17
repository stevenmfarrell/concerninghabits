import { authenticateApiRequest } from '@/lib/apiKeys';
import { apiError, habitLogBody, loggedEntry, readLogBody, valuesForForm } from '@/lib/apiRequests';
import { parseHabitSchema } from '@/lib/habitSchema';
import { getMembership } from '@/lib/access';
import { nullIfUnauthorized } from '@/lib/errors';
import { createHabitLog } from '@/lib/entries';
import { logFromInput } from '@/lib/smartEntry';

// Logs an entry on one habit for another app (a shortcut, Home Assistant), as the user whose API key
// it sends (see src/lib/apiKeys.ts). The JSON body is optional:
//   {"values": {"distance": 3}}         the form's values, by field key (text is read as the field's type)
//   {"text": "ran 3 miles in 25 min"}   for the AI to fill them in from, as with voice logging
//   {"at": "2026-10-11T07:30:00Z"}      when it was done, if not now
// `values` and `text` can go together, the values winning over what the AI fills in. Answers 201
// with the entry, or an error: 401 for the key, 403 for a key that can't log, 404 for a habit it can't log, 400 for what was sent,
// and 422 for text that couldn't fill in the form.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApiRequest(request, 'log');
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const read = await readLogBody(request, habitLogBody);
  if (!read.ok) return read.response;
  const { body, createdAt } = read;

  const membership = await getMembership(auth.user.id, id).catch(nullIfUnauthorized);
  if (!membership) return apiError('There\'s no habit with that id that you can log', 404);
  const { habit } = membership;

  const schema = parseHabitSchema(habit.schema);
  const checked = valuesForForm(schema, body.values ?? {});
  if ('unknownKeys' in checked) {
    const keys = Object.keys(schema.properties ?? {});
    return apiError(`${habit.name} has no field ${checked.unknownKeys.map(k => `"${k}"`).join(', ')}. ${keys.length > 0 ? `Its fields are ${keys.map(k => `"${k}"`).join(', ')}.` : 'It has no fields.'}`, 400);
  }

  if (body.text) {
    const result = await logFromInput(auth.user, id, body.text, checked.values, createdAt);
    if (!result.success) return apiError(result.error, 422);
    if (!result.logged) return apiError(result.problem, 422, { values: result.data });
    return loggedEntry({ id: result.logId, createdAt: result.createdAt }, habit, result.data);
  }

  try {
    const log = await createHabitLog(auth.user, id, checked.values, createdAt);
    return loggedEntry(log, habit, JSON.parse(log.payload));
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Those values aren\'t valid', 400);
  }
}
