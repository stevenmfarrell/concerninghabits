import { z } from 'zod';
import { MAX_AI_INPUT_LENGTH } from './constants';
import { fieldsOf, valueFromText } from './formFields';
import type { HabitSchema } from './types';

// Reading what's sent to the API's logging routes (see src/app/api). Server-only.

// How far ahead of the server's clock an entry's time can be, for a sender's clock running a little fast
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
// The most a request body can be, well over any entry (see MAX_LOG_PAYLOAD_BYTES)
const MAX_BODY_BYTES = 16 * 1024;

const at = z.string().optional().describe('When it was done, as an ISO 8601 date and time');

// A habit's own log route: its form's values, and optionally text for the AI to fill them in from
export const habitLogBody = z.object({
  values: z.record(z.string(), z.unknown()).optional(),
  text: z.string().trim().min(1).max(MAX_AI_INPUT_LENGTH).optional(),
  at,
}).strict();

// The log route for any habit: text for the AI to match to a habit and fill in its form from
export const smartLogBody = z.object({
  text: z.string().trim().min(1).max(MAX_AI_INPUT_LENGTH),
  at,
}).strict();

export const apiError = (error: string, status: number, extra?: Record<string, unknown>) => Response.json({ error, ...extra }, { status });

// A request's JSON body read with `schema`, and its `at` as a Date, or the response to send when it
// can't be. An empty body is an empty object, so a habit with no form can be logged with no body.
export async function readLogBody<T extends { at?: string }>(request: Request, schema: z.ZodType<T>): Promise<
  { ok: true; body: T; createdAt?: Date } | { ok: false; response: Response }
> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: apiError('The request is too big', 413) };
  let json: unknown = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, response: apiError('The body must be JSON', 400) };
    }
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const unknownKeys = parsed.error.issues.flatMap(issue => (issue.code === 'unrecognized_keys' ? issue.keys : []));
    const hint = unknownKeys.length > 0 && (schema as unknown) === habitLogBody ? ` Put the habit's fields under "values", e.g. {"values": {"${unknownKeys[0]}": ...}}.` : '';
    return { ok: false, response: apiError(`${z.prettifyError(parsed.error).replace(/\n/g, ' ')}${hint}`, 400) };
  }

  if (parsed.data.at === undefined) return { ok: true, body: parsed.data };
  const createdAt = new Date(parsed.data.at);
  if (Number.isNaN(createdAt.getTime())) return { ok: false, response: apiError('"at" must be a date and time, like 2026-10-11T07:30:00-07:00', 400) };
  if (createdAt.getTime() > Date.now() + MAX_CLOCK_SKEW_MS) return { ok: false, response: apiError('"at" can\'t be in the future', 400) };
  return { ok: true, body: parsed.data, createdAt };
}

// Values sent for a habit's form, as its fields' types (see valueFromText), or the keys it doesn't have
export function valuesForForm(schema: HabitSchema, values: Record<string, unknown>): { values: Record<string, unknown> } | { unknownKeys: string[] } {
  const fields = fieldsOf(schema);
  const unknownKeys = Object.keys(values).filter(key => !(key in fields));
  if (unknownKeys.length > 0) return { unknownKeys };
  return { values: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, valueFromText(fields[key], value)])) };
}

// What a logged entry is sent back as
export function loggedEntry(log: { id: string; createdAt: Date }, habit: { id: string; name: string }, values: Record<string, unknown>) {
  return Response.json({ id: log.id, habit: { id: habit.id, name: habit.name }, loggedAt: log.createdAt.toISOString(), values }, { status: 201 });
}
