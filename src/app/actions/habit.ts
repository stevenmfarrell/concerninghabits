'use server';

import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
import { choice, TypeSafeClient, type ChoiceCriteria } from '@typesafe-ai/sdk';
import { z } from 'zod';
import { getDefaultUser, getCategories, getLoggableHabits } from './db';
import { buildCategoryChoices } from '@/lib/categoryChoices';
import type { HabitSchema } from '@/lib/types';

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
        frequency: z.enum(['daily', 'weekly', 'monthly', 'multiple']).optional().describe("The suggested tracking cadence"),
        type: z.literal('object'),
        properties: z.record(z.string(), z.any()).describe(`The fields required. Keep it simple. Use empty {} for simple boolean tasks. CRITICAL: For time durations, set 'type': 'number' AND 'x-widget': 'duration'. For other numeric fields, include an 'x-unit' key specifying the unit of measurement (e.g., 'miles', 'lbs', 'oz', 'pages'). The user prefers the ${user.unitSystem} measurement system.`),
        required: z.array(z.string()).optional().describe("Array of required property keys"),
      }),
    });

    // category and frequency are suggestions for the editor, not part of the habit's form schema
    const { category, frequency, ...schema } = object;
    return {
      success: true,
      schema,
      frequency,
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
const MAX_CANDIDATES = 3;

// A habit a spoken phrase might be an entry for, or `habitId: null` for a new habit
export type SpokenHabitCandidate = { habitId: string | null; name: string; probability: number };

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

// Decide which of the user's habits something they said they did is an entry for, or whether it's
// a new habit. Candidates are the most likely options, best first; `confident` says whether the
// first is sure enough to act on without asking the user.
export async function matchSpokenHabit(transcript: string): Promise<
  { success: true; confident: boolean; candidates: SpokenHabitCandidate[] } | { success: false; error: string }
> {
  const habits = await getLoggableHabits();
  if (habits.length === 0) {
    return { success: true, confident: true, candidates: [{ habitId: null, name: 'New habit', probability: 1 }] };
  }

  const options = new Map<string, SpokenHabitCandidate>([
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

  try {
    const { answers } = await getTypeSafe().systemOne({
      state: { said: transcript },
      questions: {
        habit: choice(
          'The user said `said` out loud to record something they did. Which of their habits is it an entry for?',
          criteria,
        ),
      },
    });

    const candidates = Object.entries(answers.habit.probabilities)
      .filter(([option]) => options.has(option))
      .sort(([, a], [, b]) => b - a)
      .slice(0, MAX_CANDIDATES)
      .map(([option, probability]) => ({ ...options.get(option)!, probability }));

    return { success: true, confident: answers.habit.confidence >= MATCH_CONFIDENCE_THRESHOLD, candidates };
  } catch (error) {
    console.error("Error matching spoken habit:", error);
    return { success: false, error: "Failed to match what you said to a habit." };
  }
}
