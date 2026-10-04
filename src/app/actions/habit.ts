'use server';

import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
import { choice, noul, TypeSafeClient, type ChoiceCriteria } from '@typesafe-ai/sdk';
import { z } from 'zod';
import { getDefaultUser, getCategories, getHabit, getLoggableHabits, logHabitEvent } from './db';
import { buildCategoryChoices } from '@/lib/categoryChoices';
import type { HabitSchema } from '@/lib/types';
import { CADENCE_TYPES, cadenceFromSuggestion } from '@/lib/cadence';
import { calculatedFieldProblem, isFormulaInput, type CalculatedField } from '@/lib/calculatedFields';
import { fieldsOf } from '@/lib/formFields';

export async function generateHabitSchema(prompt: string, currentSchema?: HabitSchema) {
  const user = await getDefaultUser();

  // Let the AI choose from the user's own categories, then map its choice back to an id
  const categoryIdsByLabel = buildCategoryChoices(await getCategories());
  const categoryLabels = [...categoryIdsByLabel.keys()];
  const categorySchema = categoryLabels.length > 0
    ? z.enum(categoryLabels as [string, ...string[]]).describe(
        "The user's category this habit best fits into. Subcategories are written 'Parent:Child' (e.g. 'Fitness:Cardio' is the Cardio subcategory of Fitness). Prefer the most specific subcategory that fits; use the parent category when no subcategory fits."
      )
    : z.null();

  try {
    const { object } = await generateObject({
      model: google('gemini-flash-lite-latest'),
      maxRetries: 0,
      system: `You are an expert at creating JSON Schemas for dynamic forms. 
      Given a description of a habit, generate a valid JSON schema (draft-07) to collect the required data. 
      The schema MUST be of type 'object'. Provide human-readable titles for fields.
      CRITICAL INSTRUCTION: For simple event-based habits (e.g., "take my medicine", "drank water"), the 'properties' object MUST be completely empty ({}). DO NOT add checkboxes, confirmation booleans, or any other fields. The presence of the log entry itself confirms the event.
      CRITICAL INSTRUCTION: Keep the habit title extremely short and concise. Do NOT prefix the title with words like "Track", "Log", or "Record". (e.g. use "Morning Run" instead of "Track morning run").
      ${user.useEmojiTitle ? `CRITICAL INSTRUCTION: You MUST put exactly one relevant emoji at the very start of the habit title (e.g., "🏃 Morning Run"). ${user.emojiModifier ? `The user requested the following style/modifiers for emojis: "${user.emojiModifier}". (e.g. skin tone, gender). Apply this whenever applicable.` : ''}` : 'CRITICAL INSTRUCTION: Do NOT include any emojis in the habit title.'}
      For complex habits, define the properties (e.g., distance, time, notes).
      
      ${currentSchema ? `The user wants to tweak an existing schema. Here is the current schema:\n${JSON.stringify(currentSchema, null, 2)}\nUpdate it according to their new instructions. Preserve the existing title unless asked to change it.` : ''}`,
      prompt: `User instructions: ${prompt}`,
      schema: z.object({
        title: z.string().describe(`A short, concise name for the habit. Do NOT prefix with 'Track' or 'Log'. ${user.useEmojiTitle ? 'MUST start with a relevant emoji.' : 'NO emojis.'}`),
        category: categorySchema.optional(),
        cadence: z.object({
          type: z.enum(CADENCE_TYPES).describe("How often the habit is meant to be done. DEFAULT TO 'none' (logged whenever it happens, nothing expected): most habits just record something when it happens, e.g. 'track when I go on a walk', 'log my runs', 'I just went for a walk'. Only choose a recurring cadence when the user clearly says they want to do it regularly: 'daily' (e.g. 'I want to walk every day'; several times a day for e.g. 'drink 8 glasses of water a day'), 'everyNDays' (again N days after the last time, e.g. 'water the plants every 3 days'), 'calendarWeek' (a set number of times per calendar week, e.g. 'call mom every week', 'go to the gym 3 times a week'), 'calendarMonth' (a set number of times per calendar month, e.g. 'pay rent each month', 'get a massage twice a month')."),
          timesPerDay: z.number().int().optional().describe("For 'daily': how many times a day, if more than once (e.g. 8 glasses of water)"),
          days: z.number().int().optional().describe("For 'everyNDays': how many days apart, 2 or more"),
          timesPerPeriod: z.number().int().optional().describe("For 'calendarWeek' or 'calendarMonth': how many times per week or month, if more than once (e.g. 3 for 'the gym 3 times a week')"),
        }).optional().describe("The suggested cadence. Leave it out, or use type 'none', unless the user clearly wants this to recur."),
        type: z.literal('object'),
        properties: z.record(z.string(), z.any()).describe(`The fields required. Keep it simple. Use empty {} for simple boolean tasks. CRITICAL: For time durations, set 'type': 'number' AND 'x-widget': 'duration'. For free-form writing that may run to several sentences or lines (e.g. notes, a journal entry, a reflection, what went well), set 'type': 'string' AND 'x-widget': 'textarea'; leave short text like a name or a place as a plain string. For other numeric fields, include an 'x-unit' key specifying the unit of measurement (e.g., 'miles', 'lbs', 'oz', 'pages'). The user prefers the ${user.unitSystem} measurement system.`),
        required: z.array(z.string()).optional().describe("Array of required property keys"),
      }),
    });

    // category and cadence are suggestions for the editor, not part of the habit's form schema
    const { category, cadence, ...schema } = object;
    return {
      success: true,
      schema,
      cadence: cadenceFromSuggestion(cadence),
      categoryId: category ? categoryIdsByLabel.get(category) : undefined,
    };
  } catch (error) {
    console.error("Error generating schema:", error);
    return { success: false, error: "Failed to generate schema." };
  }
}

// The user's own context for a habit (see HabitMember.aiContext), for the form-filling prompts
const AI_CONTEXT_INSTRUCTION = `You may also be given the user's own notes about how they do this habit. Use them to fill in values the input implies but doesn't state (e.g. if the notes say "my bike commute is 4 miles, 30 minutes" and the user says they bike commuted, fill in 4 miles and 30 minutes). A value the input states explicitly always wins over the notes.`;

function aiContextPrompt(aiContext?: string | null) {
  return aiContext ? `\n\nThe user's notes about this habit:\n${aiContext}` : '';
}

export async function parseVoiceLog(schemaStr: string, transcript: string, aiContext?: string | null) {
  await getDefaultUser();

  try {
    const { object } = await generateObject({
      model: google('gemini-flash-lite-latest'),
      schema: z.record(z.string(), z.any()),
      system: `You are an AI assistant that extracts structured data from a user's voice transcript to fill out a habit tracking form.
You are given the JSON schema for the form.
You must map the transcript to the schema's 'properties'.
Return ONLY a flat JSON object where the keys exactly match the property keys from the schema, and the values are the extracted data.
DO NOT nest your response inside a 'properties' key.
If the transcript implies a value that matches a field, include it. Otherwise omit it.
CRITICAL: A property with "x-widget": "duration" must be returned as TOTAL MINUTES, as a decimal number — e.g. "90 seconds" is 1.5, "2 hours 30 minutes" is 150, "25 minutes 30 seconds" is 25.5. Never return seconds or an "HH:MM:SS" string for these fields.
${AI_CONTEXT_INSTRUCTION}`,
      prompt: `Form Schema:\n${schemaStr}${aiContextPrompt(aiContext)}\n\nVoice Transcript:\n"${transcript}"`,
    });

    return { success: true, data: object };
  } catch (error) {
    console.error("Error parsing voice log:", error);
    return { success: false, error: "Failed to parse voice log." };
  }
}

export async function parseImageLog(schemaStr: string, base64Image: string, aiContext?: string | null) {
  await getDefaultUser();

  try {
    const base64Data = base64Image.split(',')[1];
    
    const { object } = await generateObject({
      model: google('gemini-flash-lite-latest'),
      schema: z.record(z.string(), z.any()),
      system: `You are an AI assistant that extracts structured data from an image to fill out a habit tracking form.
You are given the JSON schema for the form.
Analyze the image (e.g. a treadmill screen, a handwritten log, a meal) and map the relevant information to the schema's 'properties'.
Return ONLY a flat JSON object where the keys exactly match the property keys from the schema, and the values are the extracted data.
DO NOT nest your response inside a 'properties' key.
If the image implies a value that matches a field, include it. Otherwise omit it.
CRITICAL: A property with "x-widget": "duration" must be returned as TOTAL MINUTES, as a decimal number — e.g. "90 seconds" is 1.5, "2 hours 30 minutes" is 150, "25 minutes 30 seconds" is 25.5. Never return seconds or an "HH:MM:SS" string for these fields.
${AI_CONTEXT_INSTRUCTION}`,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Form Schema:\n${schemaStr}${aiContextPrompt(aiContext)}\n\nExtract the relevant data from this image.` },
            { type: 'image', image: base64Data }
          ],
        },
      ],
    });

    return { success: true, data: object };
  } catch (error) {
    console.error("Error parsing image log:", error);
    return { success: false, error: "Failed to parse image log." };
  }
}

// Created on first use rather than at import, since the constructor throws without
// TYPESAFE_API_KEY and that shouldn't break the Gemini-only actions in this file.
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
  let properties: Record<string, { title?: string }> = {};
  try {
    properties = JSON.parse(habit.schema).properties || {};
  } catch {}
  const fields = Object.entries(properties).map(([key, prop]) => prop.title || key);
  if (!habit.description && fields.length === 0 && !habit.aiContext) return null;
  return {
    ...(habit.description ? { description: habit.description } : {}),
    ...(fields.length > 0 ? { records: fields } : {}),
    ...(habit.aiContext ? { users_notes: habit.aiContext } : {}),
  };
}

// Interpret something the user said or typed on the dashboard: which of their habits it's about
// (or a new one), and whether it reports something they did (so it becomes an entry) or only
// describes a habit to set up. Both are asked of Jev in one request. Candidates are the most likely
// habits, best first; `confident` says whether the first is sure enough to act on without asking.
export async function interpretSmartEntry(input: string): Promise<
  { success: true; confident: boolean; candidates: HabitCandidate[]; didIt: boolean } | { success: false; error: string }
> {
  const habits = await getLoggableHabits();

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

// Logs something the user said or typed on the dashboard (see SmartEntry) to the habit it was
// matched to, filling in the habit's form from it the same way as voice logging, so it can be
// logged without leaving the dashboard. When the form can't be completed from what was said, nothing
// is logged and what could be filled in is returned (`logged: false`) for the user to finish on the
// habit's page.
export async function logSmartEntry(habitId: string, input: string): Promise<
  | { success: true; logged: true; logId: string; data: Record<string, unknown>; schema: HabitSchema }
  | { success: true; logged: false; data: Record<string, unknown> }
  | { success: false; error: string }
> {
  const filled = await fillFromInput(habitId, input);
  if (!filled.success) return filled;
  const { data, schema } = filled;

  const isComplete = (schema.required ?? []).every(field => data[field] !== undefined && data[field] !== null && data[field] !== '');
  if (!isComplete) return { success: true, logged: false, data };

  try {
    const log = await logHabitEvent(habitId, data);
    return { success: true, logged: true, logId: log.id, data, schema };
  } catch {
    // e.g. a value the AI filled in that the form doesn't accept: let the user fix it on the form
    return { success: true, logged: false, data };
  }
}

// A habit's form filled in from something the user said or typed, the same way as voice logging:
// only the habit's own fields, as logging keeps. Nothing to fill in for a habit with no form.
async function fillFromInput(habitId: string, input: string): Promise<
  { success: true; data: Record<string, unknown>; schema: HabitSchema } | { success: false; error: string }
> {
  const habit = await getHabit(habitId);
  if (!habit) return { success: false, error: 'Habit not found.' };

  let schema: HabitSchema = {};
  try {
    schema = JSON.parse(habit.schema);
  } catch {}

  if (Object.keys(schema.properties ?? {}).length === 0) return { success: true, data: {}, schema };
  const parsed = await parseVoiceLog(habit.schema, input, habit.aiContext);
  if (!parsed.success || !parsed.data) return { success: false, error: parsed.error || 'AI could not understand' };
  return { success: true, data: Object.fromEntries(Object.entries(parsed.data).filter(([key]) => key in schema.properties!)), schema };
}

// What could be filled in on a habit's form from input that matched the habit but didn't read as
// something done (see SmartEntry), for the user to check and log themselves if it was. Empty when
// nothing could be: an intention like "I want to track my weight" names no values. Best effort, so
// a failure is just nothing filled in.
export async function prefillSmartEntry(habitId: string, input: string): Promise<Record<string, unknown>> {
  const filled = await fillFromInput(habitId, input);
  return filled.success ? filled.data : {};
}

// A calculated field drafted from what the user asked for (e.g. "pace per mile"), for them to check
// before it's saved. `current` is the field being changed, for a follow-up like "make it km/h".
// The formula is checked against `schema` (the form as it is in the editor, which may not be saved
// yet), and the AI is asked once more with the problem if it doesn't work.
export async function generateCalculatedField(request: string, schema: HabitSchema, current?: Omit<CalculatedField, 'key'>): Promise<
  { success: true; field: Omit<CalculatedField, 'key'> } | { success: false; error: string }
> {
  const user = await getDefaultUser();

  const inputs = Object.entries(fieldsOf(schema))
    .filter(([, field]) => isFormulaInput(field))
    .map(([key, field]) => ({
      key,
      title: field.title || key,
      type: field['x-widget'] === 'duration' ? 'duration, in minutes' : field.type === 'boolean' ? 'yes or no, as 1 or 0' : field.type === 'integer' ? 'whole number' : 'number',
      ...(field['x-unit'] ? { unit: field['x-unit'] } : {}),
    }));
  if (inputs.length === 0) return { success: false, error: 'This habit has no number fields to calculate from.' };

  const system = `You define a calculated field for a habit-tracking app: a value worked out from the numbers in each single entry the user logs, which is then charted over time.
The habit's form has these fields (use the keys in formulas):
${JSON.stringify(inputs, null, 2)}

Write the formula using only those keys, numbers, + - * / and parentheses. No functions, no other names.
Durations are stored as total minutes, so e.g. a pace in minutes per mile is \`duration / distance\`, and a speed in miles per hour is \`distance / (duration / 60)\`.
Set format to 'duration' only when the result is itself a length of time in minutes (e.g. a pace in minutes per mile), so it's shown as m:ss; otherwise 'number'.
Give the unit the result is in, e.g. "min/mile", "mph", "lbs". The user prefers the ${user.unitSystem} measurement system when converting.
A calculated field works on one entry at a time. If the user asks for something across several entries (a total or average per week, a count, a streak, a change since last time), or something the fields can't give, set possible to false and say why in reason, briefly, in plain words to the user.
${current ? `The user is changing this existing calculated field: ${JSON.stringify(current)}. Keep its title unless they ask for a different value.` : ''}`;

  const outputSchema = z.object({
    possible: z.boolean().describe('Whether a value from each single entry can give what the user asked for'),
    reason: z.string().optional().describe("When not possible: why, in a short sentence to the user"),
    title: z.string().describe('A short name for the value, e.g. "Pace", "Speed", "Total volume"'),
    expression: z.string().describe('The formula, e.g. "duration / distance"'),
    unit: z.string().describe('The unit of the result, e.g. "min/mile", or "" for none'),
    format: z.enum(['number', 'duration']),
  });

  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: google('gemini-flash-lite-latest'),
        maxRetries: 0,
        system,
        prompt: `User request: ${request}${feedback}`,
        schema: outputSchema,
      });
      if (!object.possible) return { success: false, error: object.reason || "That can't be worked out from a single entry." };

      const field = {
        title: object.title.trim(),
        expression: object.expression.trim(),
        unit: object.unit.trim() || undefined,
        format: object.format,
      };
      const problem = field.title ? calculatedFieldProblem(field, schema) : 'The field needs a name';
      if (!problem) return { success: true, field };
      feedback = `\n\nYour last answer was ${JSON.stringify(field)}, which doesn't work: ${problem}. Fix it.`;
    } catch (error) {
      console.error('Error generating calculated field:', error);
      return { success: false, error: 'Failed to make that calculated field.' };
    }
  }
  return { success: false, error: "Couldn't make a formula for that from this habit's fields." };
}
