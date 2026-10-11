// Which of the user's habits something they said or typed is about (or a new one), and whether it
// reports something they did. For interpretInput (see src/app/actions/smartEntry.ts). Three ways to
// answer, chosen with HABIT_MATCHER:
//
//   jev   TypeSafe's Jev (needs TYPESAFE_API_KEY). Calibrated probabilities, so the best matcher.
//   llm   The AI model every other request uses (see aiModel.ts), for a setup without TypeSafe.
//   none  No AI: habits ranked by the words they share with the input, for the user to pick from.
//
// Left unset, it's the first of those that's set up. Server-only.

import { generateObject } from 'ai';
import { choice, noul, TypeSafeClient, type ChoiceCriteria } from '@typesafe-ai/sdk';
import { z } from 'zod';
import { aiModel, aiModelConfigured } from './aiModel';
import { fieldsOf } from './formFields';
import { parseHabitSchema } from './habitSchema';

// A habit the user's input might be about, or `habitId: null` for a new habit. `probability` is
// Jev's, and null from a matcher that doesn't give one.
export type HabitCandidate = { habitId: string | null; name: string; probability: number | null };

// The most likely habits, best first. `confident` says whether the first is sure enough to act on
// without asking, and `didIt` whether the input reports something done (so it becomes an entry)
// rather than only describing a habit to set up.
export type HabitMatch = { confident: boolean; candidates: HabitCandidate[]; didIt: boolean };

export type MatchableHabit = { id: string; name: string; description: string | null; schema: string; aiContext: string | null };

const MATCHERS = ['jev', 'llm', 'none'] as const;
export type HabitMatcherName = (typeof MATCHERS)[number];

// Read on each request rather than once, so it follows the environment it's given
export function habitMatcherName(): HabitMatcherName {
  const set = process.env.HABIT_MATCHER?.trim().toLowerCase();
  if (set) {
    if (!(MATCHERS as readonly string[]).includes(set)) {
      throw new Error(`HABIT_MATCHER "${set}" isn't one of: ${MATCHERS.join(', ')}.`);
    }
    return set as HabitMatcherName;
  }
  if (process.env.TYPESAFE_API_KEY) return 'jev';
  return aiModelConfigured() ? 'llm' : 'none';
}

export function matchHabit(input: string, habits: MatchableHabit[], matcher: HabitMatcherName): Promise<HabitMatch> {
  return { jev: matchWithJev, llm: matchWithModel, none: matchByWords }[matcher](input, habits);
}

const NEW_HABIT: HabitCandidate = { habitId: null, name: 'New habit', probability: null };
// A Choice accepts at most 255 options, one of which is the new-habit option. The other matchers
// keep to it too, so every matcher sees the same habits.
const MAX_HABIT_OPTIONS = 254;
const MAX_CANDIDATES = 3;

// What a matcher is told about a habit besides its name: its description, the fields its form
// records, and the user's own notes on it (which can name things the habit's title doesn't, like
// "bike commute")
function describeHabitForMatching(habit: MatchableHabit) {
  const fields = Object.entries(fieldsOf(parseHabitSchema(habit.schema))).map(([key, prop]) => prop.title || key);
  if (!habit.description && fields.length === 0 && !habit.aiContext) return null;
  return {
    ...(habit.description ? { description: habit.description } : {}),
    ...(fields.length > 0 ? { records: fields } : {}),
    ...(habit.aiContext ? { users_notes: habit.aiContext } : {}),
  };
}

// --- Jev ---

// Created on first use rather than at import, since the constructor throws without
// TYPESAFE_API_KEY and that shouldn't break a setup using another matcher
let typesafe: TypeSafeClient | undefined;
function getTypeSafe() {
  return (typesafe ??= new TypeSafeClient());
}

// Jev's option for "none of the user's habits". Habits are option-named after themselves, so this
// is claimed first and a habit that happens to share the name gets a numbered option instead.
const NEW_HABIT_OPTION = 'new habit';
// Below this confidence the user picks from the top candidates instead of the app acting on Jev's
// pick. Measured on jev-1.13 against a real habit list: clear matches ("I practiced keys" -> Piano
// Practice) and clear new habits ("20 minutes of yoga") came back at 0.87-0.99, while a vague
// "I played some music" (piano? ukulele? new?) varied 0.61-0.71 across calls. 0.8 sits in that gap.
const MATCH_CONFIDENCE_THRESHOLD = 0.8;
// At or above this, the input counts as reporting something the user did (or measured), so it
// becomes an entry. Measured on jev-1.13: intentions ("I want to run more", "track my water
// intake", "I want to track my weight") came back at 0.02-0.04, reports ("I ran 3 miles", "took my
// vitamins") and readings ("I weigh 155 pounds", "blood pressure 120 over 80", "slept 7 hours") at
// 0.83-0.98, and bare nouns ("yoga", "water") at 0.40-0.49. The bar is kept low so a bare noun
// counts as done: that's the likelier meaning for an existing habit, an entry can be undone, and a
// new habit's draft page can switch its first entry off.
const DID_IT_THRESHOLD = 0.25;

// Both questions are asked of Jev in one request
async function matchWithJev(input: string, habits: MatchableHabit[]): Promise<HabitMatch> {
  const options = new Map<string, HabitCandidate>([[NEW_HABIT_OPTION, NEW_HABIT]]);
  const criteria: ChoiceCriteria = {
    [NEW_HABIT_OPTION]: "Something none of the user's other habits track, so it would need a new habit",
  };
  for (const habit of habits.slice(0, MAX_HABIT_OPTIONS)) {
    const name = habit.name.trim() || 'Untitled habit';
    let option = name;
    for (let n = 2; options.has(option); n++) option = `${name} (${n})`;
    options.set(option, { habitId: habit.id, name: habit.name, probability: null });
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

  // With no habits there's nothing to choose between, so only whether they did it is asked
  if (habits.length === 0) {
    const { answers } = await getTypeSafe().systemOne({
      state: { user_input: input },
      questions: { did_it: didItQuestion },
    });
    return { confident: true, candidates: [{ ...NEW_HABIT, probability: 1 }], didIt: answers.did_it.noul >= DID_IT_THRESHOLD };
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
    confident: answers.habit.confidence >= MATCH_CONFIDENCE_THRESHOLD,
    candidates,
    didIt: answers.did_it.noul >= DID_IT_THRESHOLD,
  };
}

// --- The AI model ---

const KIND_DESCRIPTION = `"did" if the input reports something to record right now: something the user did, or a measurement or reading they took (e.g. "I ran 3 miles", "took my vitamins", "20 minutes of yoga", "I weigh 155 pounds", "blood pressure 120 over 80", or just "yoga"). "intends" only if it describes a habit they want to set up or an intention (e.g. "track my water intake", "I want to start running more").`;

// A general model's stated confidence isn't calibrated the way Jev's probabilities are (small
// models call nearly everything 0.95), so it's asked for a pick and a yes-or-no "sure" instead,
// told to say no when in doubt. Unsure, the user picks; the API and offline sync log nothing.
async function matchWithModel(input: string, habits: MatchableHabit[]): Promise<HabitMatch> {
  const kind = z.enum(['did', 'intends']).describe(KIND_DESCRIPTION);

  if (habits.length === 0) {
    const { object } = await generateObject({
      model: aiModel(),
      schema: z.object({ kind }),
      system: 'You read what a user told their habit-tracking app.',
      prompt: `User input: "${input}"`,
    });
    return { confident: true, candidates: [NEW_HABIT], didIt: object.kind === 'did' };
  }

  // Habits are numbered, so the model answers with one of a fixed set rather than retyping a name
  const listed = habits.slice(0, MAX_HABIT_OPTIONS);
  const numbers = listed.map((_, i) => String(i + 1));
  const pick = z.enum(['new', ...numbers]);
  const { object } = await generateObject({
    model: aiModel(),
    schema: z.object({
      habit: pick.describe('The number of the habit the input is about, or "new" if none of them track it'),
      sure: z.boolean().describe('true only if the input clearly means this habit and no other listed habit could reasonably be meant. When in doubt, false: the user is then asked to pick.'),
      alternatives: z.array(pick).describe('Up to 2 other habits (or "new") it could plausibly be about, most likely first. Empty if there are none.'),
      kind,
    }),
    system: `You match what a user told their habit-tracking app to one of their habits.

The user's habits:
${listed.map((habit, i) => {
  const details = describeHabitForMatching(habit);
  return `${i + 1}. ${habit.name.trim() || 'Untitled habit'}${details ? ` ${JSON.stringify(details)}` : ''}`;
}).join('\n')}`,
    prompt: `User input: "${input}"`,
  });

  const candidateFor = (option: string): HabitCandidate | undefined => {
    if (option === 'new') return NEW_HABIT;
    const habit = listed[Number(option) - 1];
    return habit && { habitId: habit.id, name: habit.name, probability: null };
  };
  const candidates = [...new Set([object.habit, ...object.alternatives])]
    .map(candidateFor)
    .filter(candidate => candidate !== undefined)
    .slice(0, MAX_CANDIDATES);

  return { confident: object.sure, candidates, didIt: object.kind === 'did' };
}

// --- No AI ---

// How many habits to offer when nothing picks one, ranked by the words they share with the input
const MAX_WORD_CANDIDATES = 6;

// Lowercase words of three letters or more, so "a" or "to" don't count as shared
function wordsOf(text: string) {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word => word.length >= 3);
}

// "run" and "running", or "vitamin" and "vitamins", count as the same word
function sameWord(a: string, b: string) {
  return a.startsWith(b) || b.startsWith(a);
}

// Never confident, so the user always picks (and the API and offline sync log nothing). A word
// shared with a habit's name counts more than one shared with its description, fields or notes.
// It reads as something done: that's the likelier meaning, an entry can be undone, and a new
// habit's draft page can switch its first entry off.
async function matchByWords(input: string, habits: MatchableHabit[]): Promise<HabitMatch> {
  if (habits.length === 0) return { confident: true, candidates: [NEW_HABIT], didIt: true };

  const inputWords = wordsOf(input);
  const shared = (text: string) => wordsOf(text).filter(word => inputWords.some(inputWord => sameWord(word, inputWord))).length;
  const ranked = habits
    .slice(0, MAX_HABIT_OPTIONS)
    .map((habit, order) => ({
      habit,
      order,
      score: 2 * shared(habit.name) + shared(Object.values(describeHabitForMatching(habit) ?? {}).flat().join(' ')),
    }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, MAX_WORD_CANDIDATES);

  return {
    confident: false,
    candidates: ranked.map(({ habit }) => ({ habitId: habit.id, name: habit.name, probability: null })),
    didIt: true,
  };
}
