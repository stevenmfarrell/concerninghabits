// What turns something said or typed into an entry: matching it to one of the user's habits (see
// habitMatcher.ts), and the AI model (see aiModel.ts) filling in the habit's form from it. For the
// dashboard's smart entry and voice logging (see src/app/actions/habit.ts) and the API (see
// src/app/api), so each takes the user rather than reading the session. These don't refresh any
// pages; the actions do that after. Server-only.

import { generateObject } from 'ai';
import { z } from 'zod';
import { prisma } from './prisma';
import { aiRequestProblem } from './aiLimits';
import { fieldsOf } from './formFields';
import { parseEntryValues, parseHabitSchema } from './habitSchema';
import type { HabitSchema } from './types';
import { aiContextPrompt, formFillSystem } from './aiPrompts';
import { aiFailureMessage, aiModel, aiTimeoutSignal } from './aiModel';
import { habitMatcherName, matchHabit, type HabitCandidate, type HabitMatch, type HabitMatcherName } from './habitMatcher';
import { whenDone } from './entryDate';
import { getMembership } from './access';
import { nullIfUnauthorized } from './errors';
import { createHabitLog } from './entries';

// Who an entry is logged for, with whose days it's placed on. `timeZone` is null until their browser
// has reported one, when the server's is used, as pages do (see getDefaultUser).
export type EntryUser = { id: string; name: string; timeZone: string | null; bedtime: string };

// When something said or typed says it was done (see whenDone), counted from `reference`, or null
// for then
export function whenSaid(user: EntryUser, input: string, reference = new Date()) {
  return whenDone(input, { timeZone: user.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, bedtime: user.bedtime }, reference);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the AI's values, checked when logged
export type ParsedLog = { success: boolean; data?: Record<string, any>; error?: string };

// A form filled in from what the user said or typed. Unchecked: callers check what they're given.
export async function extractFromTranscript(schemaStr: string, transcript: string, aiContext?: string | null): Promise<ParsedLog> {
  try {
    const { object } = await generateObject({
      model: aiModel(),
      abortSignal: aiTimeoutSignal(),
      schema: z.record(z.string(), z.any()),
      system: formFillSystem('transcript'),
      prompt: `Form Schema:\n${schemaStr}${aiContextPrompt(aiContext)}\n\nVoice Transcript:\n"${transcript}"`,
    });

    return { success: true, data: object };
  } catch (error) {
    console.error("Error parsing voice log:", error);
    return { success: false, error: aiFailureMessage(error, "Failed to parse voice log.") };
  }
}

export type { HabitCandidate } from './habitMatcher';

// The habits a user can log (their own and those shared with them), with their notes for the AI
export async function loggableHabitsOf(userId: string) {
  const memberships = await prisma.habitMember.findMany({
    where: { userId },
    select: { aiContext: true, habit: { select: { id: true, name: true, description: true, schema: true } } },
  });
  return memberships.map(m => ({ ...m.habit, aiContext: m.aiContext }));
}

// `matcher` is which one answered (see habitMatcher.ts)
export type Interpretation = ({ success: true; matcher: HabitMatcherName } & HabitMatch) | { success: false; error: string };

// Interpret something the user said or typed: which of their habits it's about (or a new one), and
// whether it reports something they did or only describes a habit to set up, which for a new habit
// decides whether it's also its first entry (anything matched to an existing habit is logged). Candidates are the most likely habits, best first; `confident` says whether the first is sure
// enough to act on without asking.
export async function interpretInput(user: { id: string }, input: string): Promise<Interpretation> {
  try {
    const matcher = habitMatcherName();
    // Matching by words alone makes no AI request, so it doesn't count toward the limit
    if (matcher !== 'none') {
      const problem = await aiRequestProblem(user.id, input);
      if (problem) return { success: false, error: problem };
    }
    const habits = await loggableHabitsOf(user.id);
    return { success: true, matcher, ...(await matchHabit(input, habits, matcher)) };
  } catch (error) {
    console.error("Error interpreting smart entry:", error);
    return { success: false, error: aiFailureMessage(error, "Failed to match that to a habit.") };
  }
}

// A habit's form filled in from something the user said or typed, the same way as voice logging:
// only the habit's own fields, as logging keeps. Nothing to fill in for a habit with no form.
// `gone` when the habit is gone or isn't the user's, rather than the AI failing.
export async function fillFromInput(user: { id: string }, habitId: string, input: string): Promise<
  { success: true; data: Record<string, unknown>; schema: HabitSchema } | { success: false; error: string; gone?: true }
> {
  const membership = await getMembership(user.id, habitId).catch(nullIfUnauthorized);
  if (!membership) return { success: false, error: 'Habit not found.', gone: true };
  const { habit, aiContext } = membership;

  const schema = parseHabitSchema(habit.schema);
  const properties = fieldsOf(schema);
  if (Object.keys(properties).length === 0) return { success: true, data: {}, schema };
  // The habit's own form, so only the input needs checking
  const problem = await aiRequestProblem(user.id, input);
  if (problem) return { success: false, error: problem };
  const parsed = await extractFromTranscript(habit.schema, input, aiContext);
  if (!parsed.success || !parsed.data) return { success: false, error: parsed.error || 'AI could not understand' };
  return { success: true, data: Object.fromEntries(Object.entries(parsed.data).filter(([key]) => key in properties)), schema };
}

// The required fields of `schema` that `data` leaves empty
export function missingRequired(schema: HabitSchema, data: Record<string, unknown>) {
  return (schema.required ?? []).filter(field => data[field] === undefined || data[field] === null || data[field] === '');
}

export type InputLogResult =
  | { success: true; logged: true; logId: string; createdAt: Date; data: Record<string, unknown>; schema: HabitSchema }
  | { success: true; logged: false; data: Record<string, unknown>; schema: HabitSchema; problem: string; loggedAt?: Date }
  | { success: false; error: string; gone?: true };

// Logs something the user said or typed to `habitId`, filling in the habit's form from it the same
// way as voice logging. `values` are given values that win over what's filled in (e.g. sent to the
// API alongside the text). When the form can't be completed, or what was filled in isn't valid,
// nothing is logged and what could be filled in is returned (`logged: false`) for the user to finish,
// with when it says it was done (`loggedAt`). It's logged at `createdAt` (or now), unless it says
// it was done on an earlier day (e.g. "yesterday", see whenDone), counted from then.
// `id` is the entry's id when the browser made one (see createHabitLog): once it's logged, sending
// it again returns that entry without asking the AI again.
export async function logFromInput(user: EntryUser, habitId: string, input: string, values: Record<string, unknown> = {}, createdAt?: Date, id?: string): Promise<InputLogResult> {
  if (id) {
    const existing = await prisma.habitLog.findUnique({ where: { id } });
    if (existing && existing.userId === user.id && existing.habitId === habitId) {
      const membership = await getMembership(user.id, habitId);
      return { success: true, logged: true, logId: existing.id, createdAt: existing.createdAt, data: parseEntryValues(existing.payload) ?? {}, schema: parseHabitSchema(membership.habit.schema) };
    }
  }
  const filled = await fillFromInput(user, habitId, input);
  if (!filled.success) return filled;
  const { schema } = filled;
  const data = { ...filled.data, ...values };
  const loggedAt = whenSaid(user, input, createdAt) ?? createdAt;

  const missing = missingRequired(schema, data);
  if (missing.length > 0) {
    const fields = fieldsOf(schema);
    return { success: true, logged: false, data, schema, problem: `Missing ${missing.map(key => fields[key]?.title || key).join(', ')}`, loggedAt };
  }

  try {
    const log = await createHabitLog(user, habitId, data, loggedAt, id);
    return { success: true, logged: true, logId: log.id, createdAt: log.createdAt, data, schema };
  } catch (error) {
    // e.g. a value the AI filled in that the form doesn't accept: let the user fix it on the form
    return { success: true, logged: false, data, schema, problem: error instanceof Error ? error.message : 'Its values aren\'t valid', loggedAt };
  }
}

// e.g. "Piano Practice or Ukulele"
function describeCandidates(candidates: HabitCandidate[]) {
  const names = candidates.filter(c => c.habitId).map(c => c.name);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : names[0] ?? 'none of them';
}

export type AnyHabitLogResult =
  | { logged: true; habit: { id: string; name: string }; logId: string; createdAt: Date; data: Record<string, unknown> }
  // Nothing logged, saying why, with the habits it might have been (`candidates`), and when it was
  // matched to one, that habit and what could be filled in, to finish by hand
  | { logged: false; error: string; candidates: HabitCandidate[]; habit?: { id: string; name: string }; data?: Record<string, unknown> };

// Logs something the user said or typed to whichever of their habits it's about, as the quill's
// smart entry does but without asking: only to a habit the matcher is sure of, and never a new one.
// Whether it reads as something done doesn't matter, as for the quill: matched to a habit, it's
// logged. For the API (see src/app/api/log) and for text queued while offline (see src/app/api/sync).
export async function logToAnyHabit(user: EntryUser, text: string, createdAt?: Date, id?: string): Promise<AnyHabitLogResult> {
  const interpretation = await interpretInput(user, text);
  if (!interpretation.success) return { logged: false, error: interpretation.error, candidates: [] };
  const { confident } = interpretation;
  const candidates = interpretation.candidates.filter(c => c.habitId);

  const [best] = interpretation.candidates;
  if (interpretation.matcher === 'none') return { logged: false, error: `Matching text to a habit is turned off on this server, so log "${text}" to a habit directly`, candidates };
  if (!best?.habitId) return { logged: false, error: `"${text}" doesn't match any of your habits. Make one in the app first.`, candidates };
  if (!confident) return { logged: false, error: `Not sure which habit "${text}" is about: ${describeCandidates(candidates)}`, candidates };

  const habit = { id: best.habitId, name: best.name };
  const result = await logFromInput(user, best.habitId, text, {}, createdAt, id);
  if (!result.success) return { logged: false, error: result.error, candidates, habit };
  if (!result.logged) return { logged: false, error: `${best.name}: ${result.problem}`, candidates, habit, data: result.data };
  return { logged: true, habit, logId: result.logId, createdAt: result.createdAt, data: result.data };
}
