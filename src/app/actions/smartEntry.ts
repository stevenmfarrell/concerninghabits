// What turns something said or typed into an entry: Jev matching it to one of the user's habits,
// and the AI model (see aiModel.ts) filling in the habit's form from it. For the dashboard's smart
// entry and voice logging (see habit.ts) and the API (see src/app/api), so each takes the user
// rather than reading the session. Not actions themselves, since a client could then pass any user:
// only imported by server code.

import { generateObject } from 'ai';
import { choice, noul, TypeSafeClient, type ChoiceCriteria } from '@typesafe-ai/sdk';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { aiRequestProblem } from '@/lib/aiLimits';
import { fieldsOf } from '@/lib/formFields';
import { parseHabitSchema } from '@/lib/habitSchema';
import type { HabitSchema } from '@/lib/types';
import { aiContextPrompt, formFillSystem } from '@/lib/aiPrompts';
import { aiModel } from '@/lib/aiModel';
import { createHabitLog, getMembership } from './internal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the AI's values, checked when logged
export type ParsedLog = { success: boolean; data?: Record<string, any>; error?: string };

// A form filled in from what the user said or typed. Unchecked: callers check what they're given.
export async function extractFromTranscript(schemaStr: string, transcript: string, aiContext?: string | null): Promise<ParsedLog> {
  try {
    const { object } = await generateObject({
      model: aiModel(),
      schema: z.record(z.string(), z.any()),
      system: formFillSystem('transcript'),
      prompt: `Form Schema:\n${schemaStr}${aiContextPrompt(aiContext)}\n\nVoice Transcript:\n"${transcript}"`,
    });

    return { success: true, data: object };
  } catch (error) {
    console.error("Error parsing voice log:", error);
    return { success: false, error: "Failed to parse voice log." };
  }
}

// Created on first use rather than at import, since the constructor throws without
// TYPESAFE_API_KEY and that shouldn't break the actions that only use the AI model.
let typesafe: TypeSafeClient | undefined;
function getTypeSafe() {
  return (typesafe ??= new TypeSafeClient());
}

// Jev's option for "none of the user's habits". Habits are option-named after themselves, so this
// is claimed first and a habit that happens to share the name gets a numbered option instead.
const NEW_HABIT_OPTION = 'new habit';
// A Choice accepts at most 255 options, one of which is the new-habit option
const MAX_HABIT_OPTIONS = 254;
// Below this confidence the user picks from the top candidates instead of the app acting on Jev's
// pick. Measured on jev-1.13 against a real habit list: clear matches ("I practiced keys" -> Piano
// Practice) and clear new habits ("20 minutes of yoga") came back at 0.87-0.99, while a vague
// "I played some music" (piano? ukulele? new?) varied 0.61-0.71 across calls. 0.8 sits in that gap.
const MATCH_CONFIDENCE_THRESHOLD = 0.8;
// At or above this, the input counts as reporting something the user did (or measured), so it
// becomes an entry. Measured on jev-1.13: intentions ("I want to run more", "track my water
// intake", "I want to track my weight") came back at 0.02-0.04, reports ("I ran 3 miles", "took my
// vitamins") and readings ("I weigh 155 pounds", "blood pressure 120 over 80", "slept 7 hours") at
// 0.83-0.98, and bare nouns ("yoga", "water") at 0.40-0.49. The bar is kept low so a bare noun counts as done: that's the likelier
// meaning for an existing habit, an entry can be undone, and a new habit's draft page can switch
// its first entry off.
const DID_IT_THRESHOLD = 0.25;
const MAX_CANDIDATES = 3;

// A habit the user's input might be about, or `habitId: null` for a new habit
export type HabitCandidate = { habitId: string | null; name: string; probability: number };

// What Jev is told about a habit besides its name: its description, the fields its form records,
// and the user's own notes on it (which can name things the habit's title doesn't, like "bike commute")
function describeHabitForMatching(habit: { description: string | null; schema: string; aiContext: string | null }) {
  const fields = Object.entries(fieldsOf(parseHabitSchema(habit.schema))).map(([key, prop]) => prop.title || key);
  if (!habit.description && fields.length === 0 && !habit.aiContext) return null;
  return {
    ...(habit.description ? { description: habit.description } : {}),
    ...(fields.length > 0 ? { records: fields } : {}),
    ...(habit.aiContext ? { users_notes: habit.aiContext } : {}),
  };
}

// The habits a user can log (their own and those shared with them), with their notes for the AI
export async function loggableHabitsOf(userId: string) {
  const memberships = await prisma.habitMember.findMany({
    where: { userId },
    select: { aiContext: true, habit: { select: { id: true, name: true, description: true, schema: true } } },
  });
  return memberships.map(m => ({ ...m.habit, aiContext: m.aiContext }));
}

export type Interpretation = { success: true; confident: boolean; candidates: HabitCandidate[]; didIt: boolean } | { success: false; error: string };

// Interpret something the user said or typed: which of their habits it's about (or a new one), and
// whether it reports something they did (so it becomes an entry) or only describes a habit to set
// up. Both are asked of Jev in one request. Candidates are the most likely habits, best first;
// `confident` says whether the first is sure enough to act on without asking.
export async function interpretInput(user: { id: string }, input: string): Promise<Interpretation> {
  const problem = await aiRequestProblem(user.id, input);
  if (problem) return { success: false, error: problem };
  const habits = await loggableHabitsOf(user.id);

  const options = new Map<string, HabitCandidate>([
    [NEW_HABIT_OPTION, { habitId: null, name: 'New habit', probability: 0 }],
  ]);
  const criteria: ChoiceCriteria = {
    [NEW_HABIT_OPTION]: "Something none of the user's other habits track, so it would need a new habit",
  };
  for (const habit of habits.slice(0, MAX_HABIT_OPTIONS)) {
    const name = habit.name.trim() || 'Untitled habit';
    let option = name;
    for (let n = 2; options.has(option); n++) option = `${name} (${n})`;
    options.set(option, { habitId: habit.id, name: habit.name, probability: 0 });
    criteria[option] = describeHabitForMatching(habit);
  }

  const didItQuestion = noul(
    // Measurements are named alongside things done: asked only about things done, a reading like
    // "I weigh 155 pounds" scored 0.21 and went unlogged
    'Is `user_input` the user reporting something to record right now — something they did, or a measurement or reading they took — rather than only describing something they want to start tracking or doing?',
    {
      true: 'Reports something that happened or was measured, e.g. "I ran 3 miles", "took my vitamins", "20 minutes of yoga", "I weigh 155 pounds", "blood pressure 120 over 80"',
      false: 'Only describes a habit to set up or an intention, e.g. "track my water intake", "I want to start running more", "I want to track my weight"',
    },
  );

  try {
    // With no habits there's nothing to choose between, so only whether they did it is asked
    if (habits.length === 0) {
      const { answers } = await getTypeSafe().systemOne({
        state: { user_input: input },
        questions: { did_it: didItQuestion },
      });
      return {
        success: true,
        confident: true,
        candidates: [{ habitId: null, name: 'New habit', probability: 1 }],
        didIt: answers.did_it.noul >= DID_IT_THRESHOLD,
      };
    }

    const { answers } = await getTypeSafe().systemOne({
      state: { user_input: input },
      questions: {
        habit: choice('The user told their habit-tracking app `user_input`. Which of their habits is it about?', criteria),
        did_it: didItQuestion,
      },
    });

    const candidates = Object.entries(answers.habit.probabilities)
      .filter(([option]) => options.has(option))
      .sort(([, a], [, b]) => b - a)
      .slice(0, MAX_CANDIDATES)
      .map(([option, probability]) => ({ ...options.get(option)!, probability }));

    return {
      success: true,
      confident: answers.habit.confidence >= MATCH_CONFIDENCE_THRESHOLD,
      candidates,
      didIt: answers.did_it.noul >= DID_IT_THRESHOLD,
    };
  } catch (error) {
    console.error("Error interpreting smart entry:", error);
    return { success: false, error: "Failed to match that to a habit." };
  }
}

// A habit's form filled in from something the user said or typed, the same way as voice logging:
// only the habit's own fields, as logging keeps. Nothing to fill in for a habit with no form.
export async function fillFromInput(user: { id: string }, habitId: string, input: string): Promise<
  { success: true; data: Record<string, unknown>; schema: HabitSchema } | { success: false; error: string }
> {
  const membership = await getMembership(user.id, habitId).catch(() => null);
  if (!membership) return { success: false, error: 'Habit not found.' };
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
  | { success: true; logged: false; data: Record<string, unknown>; schema: HabitSchema; problem: string }
  | { success: false; error: string };

// Logs something the user said or typed to `habitId`, filling in the habit's form from it the same
// way as voice logging. `values` are given values that win over what's filled in (e.g. sent to the
// API alongside the text). When the form can't be completed, or what was filled in isn't valid,
// nothing is logged and what could be filled in is returned (`logged: false`) for the user to finish.
// `id` is the entry's id when the browser made one (see createHabitLog): once it's logged, sending
// it again returns that entry without asking the AI again.
export async function logFromInput(user: { id: string; name: string }, habitId: string, input: string, values: Record<string, unknown> = {}, createdAt?: Date, id?: string): Promise<InputLogResult> {
  if (id) {
    const existing = await prisma.habitLog.findUnique({ where: { id } });
    if (existing && existing.userId === user.id && existing.habitId === habitId) {
      const membership = await getMembership(user.id, habitId);
      return { success: true, logged: true, logId: existing.id, createdAt: existing.createdAt, data: JSON.parse(existing.payload), schema: parseHabitSchema(membership.habit.schema) };
    }
  }
  const filled = await fillFromInput(user, habitId, input);
  if (!filled.success) return filled;
  const { schema } = filled;
  const data = { ...filled.data, ...values };

  const missing = missingRequired(schema, data);
  if (missing.length > 0) {
    const fields = fieldsOf(schema);
    return { success: true, logged: false, data, schema, problem: `Missing ${missing.map(key => fields[key]?.title || key).join(', ')}` };
  }

  try {
    const log = await createHabitLog(user, habitId, data, createdAt, id);
    return { success: true, logged: true, logId: log.id, createdAt: log.createdAt, data, schema };
  } catch (error) {
    // e.g. a value the AI filled in that the form doesn't accept: let the user fix it on the form
    return { success: true, logged: false, data, schema, problem: error instanceof Error ? error.message : 'Its values aren\'t valid' };
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

// Logs something the user said or typed to whichever of their habits it's about, as the Agenda's
// smart entry does but without asking: only to a habit Jev is sure of, and never a new one. For the
// API (see src/app/api/log) and for text queued while offline (see src/app/api/sync).
export async function logToAnyHabit(user: { id: string; name: string }, text: string, createdAt?: Date, id?: string): Promise<AnyHabitLogResult> {
  const interpretation = await interpretInput(user, text);
  if (!interpretation.success) return { logged: false, error: interpretation.error, candidates: [] };
  const { confident, didIt } = interpretation;
  const candidates = interpretation.candidates.filter(c => c.habitId);

  const [best] = interpretation.candidates;
  if (!didIt) return { logged: false, error: `"${text}" doesn't read as something you did, so nothing was logged`, candidates };
  if (!best?.habitId) return { logged: false, error: `"${text}" doesn't match any of your habits. Make one in the app first.`, candidates };
  if (!confident) return { logged: false, error: `Not sure which habit "${text}" is about: ${describeCandidates(candidates)}`, candidates };

  const habit = { id: best.habitId, name: best.name };
  const result = await logFromInput(user, best.habitId, text, {}, createdAt, id);
  if (!result.success) return { logged: false, error: result.error, candidates, habit };
  if (!result.logged) return { logged: false, error: `${best.name}: ${result.problem}`, candidates, habit, data: result.data };
  return { logged: true, habit, logId: result.logId, createdAt: result.createdAt, data: result.data };
}
