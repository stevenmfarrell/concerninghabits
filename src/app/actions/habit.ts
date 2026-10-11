'use server';

import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { choice, noul, TypeSafeClient, type ChoiceCriteria } from '@typesafe-ai/sdk';
import { z } from 'zod';
import { getCategories } from './categories';
import { logHabitEvent } from './entries';
import { getHabit, getLoggableHabits } from './habits';
import { getDefaultUser } from './user';
import { buildCategoryChoices } from '@/lib/categoryChoices';
import type { HabitSchema } from '@/lib/types';
import { CADENCE_TYPES, cadenceFromSuggestion } from '@/lib/cadence';
import { calculatedFieldProblem, calculatedFieldSchema, parseCalculatedFields, type CalculatedField } from '@/lib/calculatedFields';
import { AGGREGATES, chartProblem, MAX_ROLLING_DAYS, MAX_SERIES, plottableFields, type SavedChart } from '@/lib/charts';
import { fieldsOf } from '@/lib/formFields';
import { aiRequestProblem } from '@/lib/aiLimits';
import { habitSchemaProblem, jsonBytes, parseHabitSchema } from '@/lib/habitSchema';
import { MAX_AI_CONTEXT_LENGTH } from '@/lib/constants';
import { AI_MODEL, aiContextPrompt, calculatedFieldSystem, chartSystem, describeFormulaInputs, formFillSystem, habitSchemaSystem, tidyDraftField } from '@/lib/aiPrompts';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export async function generateHabitSchema(prompt: string, currentSchema?: HabitSchema) {
  const user = await getDefaultUser();
  const problem = (currentSchema && habitSchemaProblem(currentSchema)) || await aiRequestProblem(user.id, prompt);
  if (problem) return { success: false, error: problem };

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
      model: google(AI_MODEL),
      maxRetries: 0,
      system: habitSchemaSystem(user, currentSchema),
      prompt: `User instructions: ${prompt}`,
      schema: z.object({
        title: z.string().describe(`A short, concise name for the habit. Do NOT prefix with 'Track' or 'Log'. ${user.useEmojiTitle ? 'MUST start with a relevant emoji.' : 'NO emojis.'}`),
        category: categorySchema.optional(),
        cadence: z.object({
          type: z.enum(CADENCE_TYPES).describe("How often the habit is meant to be done. DEFAULT TO 'none' (logged whenever it happens, nothing expected): most habits just record something when it happens, e.g. 'track when I go on a walk', 'log my runs', 'I just went for a walk'. Only choose a recurring cadence when the user clearly says they want to do it regularly: 'daily' (e.g. 'I want to walk every day'; several times a day for e.g. 'drink 8 glasses of water a day'), 'everyNDays' (again N days after the last time, e.g. 'water the plants every 3 days'), 'weekdays' (on particular days of the week, e.g. 'gym on Mondays, Wednesdays and Fridays', 'stand-up every weekday', 'meal prep on Sundays'), 'calendarWeek' (a set number of times per calendar week, e.g. 'call mom every week', 'go to the gym 3 times a week'), 'calendarMonth' (a set number of times per calendar month, e.g. 'pay rent each month', 'get a massage twice a month'), 'limit' (something to cut down on or quit, where each entry is one time it happened and fewer is better, e.g. 'no more than 2 coffees a day', 'takeout at most once a week', 'quit smoking', 'stop biting my nails'; for quitting, use a max of 0). Each entry of a limit habit records one occurrence, so it usually needs no fields beyond the occurrence itself."),
          timesPerDay: z.number().int().optional().describe("For 'daily': how many times a day, if more than once (e.g. 8 glasses of water)"),
          days: z.number().int().optional().describe("For 'everyNDays': how many days apart, 2 or more"),
          daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().describe("For 'weekdays': which days of the week, 0 for Sunday through 6 for Saturday (e.g. [1, 3, 5] for Monday, Wednesday and Friday)"),
          timesPerPeriod: z.number().int().optional().describe("For 'calendarWeek' or 'calendarMonth': how many times per week or month, if more than once (e.g. 3 for 'the gym 3 times a week')"),
          limitPeriod: z.enum(['day', 'week', 'month']).optional().describe("For 'limit': the period the limit is per (e.g. 'day' for '2 coffees a day', 'week' for 'takeout once a week'). 'day' for quitting something."),
          max: z.number().int().min(0).optional().describe("For 'limit': the most times allowed per period (e.g. 2 for 'no more than 2 coffees a day'), or 0 to quit it altogether"),
        }).optional().describe("The suggested cadence. Leave it out, or use type 'none', unless the user clearly wants this to recur."),
        type: z.literal('object'),
        properties: z.record(z.string(), z.any()).describe(`The fields required. Keep it simple. Use empty {} for simple boolean tasks. CRITICAL: For time durations, set 'type': 'number' AND 'x-widget': 'duration'. For free-form writing that may run to several sentences or lines (e.g. notes, a journal entry, a reflection, what went well), set 'type': 'string' AND 'x-widget': 'textarea'; leave short text like a name or a place as a plain string. For other numeric fields measured in a unit the field name doesn't already say, include an 'x-unit' key specifying the unit of measurement (e.g. 'Distance' in 'miles', 'Added Weight' in 'lbs', 'Water' in 'oz'). Leave 'x-unit' out when the field name is itself the unit, since it would only repeat it (e.g. 'Reps', 'Sets', 'Pages', 'Glasses', 'Steps', 'Pushups' have no unit). The user prefers the ${user.unitSystem} measurement system.`),
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

// A form and AI context sent from the browser checked the same as when they're saved, since
// they go into the AI request as they are
function clientFormProblem(schemaStr: string, aiContext?: string | null) {
  if (aiContext && aiContext.length > MAX_AI_CONTEXT_LENGTH) return `Context for AI must be ${MAX_AI_CONTEXT_LENGTH} characters or fewer`;
  try {
    return habitSchemaProblem(JSON.parse(schemaStr));
  } catch {
    return 'This form isn\'t valid';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the AI's values, checked when logged
type ParsedLog = { success: boolean; data?: Record<string, any>; error?: string };

export async function parseVoiceLog(schemaStr: string, transcript: string, aiContext?: string | null): Promise<ParsedLog> {
  const user = await getDefaultUser();
  const problem = clientFormProblem(schemaStr, aiContext) || await aiRequestProblem(user.id, transcript);
  if (problem) return { success: false, error: problem };
  return extractFromTranscript(schemaStr, transcript, aiContext);
}

// A form filled in from what the user said or typed. Unchecked: callers check what they're given.
async function extractFromTranscript(schemaStr: string, transcript: string, aiContext?: string | null): Promise<ParsedLog> {
  try {
    const { object } = await generateObject({
      model: google(AI_MODEL),
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

export async function parseImageLog(schemaStr: string, base64Image: string, aiContext?: string | null) {
  const user = await getDefaultUser();
  if (!/^data:image\/[a-z+.-]+;base64,/.test(base64Image)) return { success: false, error: 'That isn\'t an image.' };
  const problem = clientFormProblem(schemaStr, aiContext) || await aiRequestProblem(user.id);
  if (problem) return { success: false, error: problem };

  try {
    const base64Data = base64Image.split(',')[1];
    
    const { object } = await generateObject({
      model: google(AI_MODEL),
      schema: z.record(z.string(), z.any()),
      system: formFillSystem('image'),
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
  const fields = Object.entries(fieldsOf(parseHabitSchema(habit.schema))).map(([key, prop]) => prop.title || key);
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
  const user = await getDefaultUser();
  const problem = await aiRequestProblem(user.id, input);
  if (problem) return { success: false, error: problem };
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

  const schema = parseHabitSchema(habit.schema);
  const properties = fieldsOf(schema);
  if (Object.keys(properties).length === 0) return { success: true, data: {}, schema };
  // The habit's own form, so only the input needs checking
  const user = await getDefaultUser();
  const problem = await aiRequestProblem(user.id, input);
  if (problem) return { success: false, error: problem };
  const parsed = await extractFromTranscript(habit.schema, input, habit.aiContext);
  if (!parsed.success || !parsed.data) return { success: false, error: parsed.error || 'AI could not understand' };
  return { success: true, data: Object.fromEntries(Object.entries(parsed.data).filter(([key]) => key in properties)), schema };
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
  const problem = habitSchemaProblem(schema)
    || (current && !calculatedFieldSchema.omit({ key: true }).safeParse(current).success ? 'That calculated field isn\'t valid' : null)
    || await aiRequestProblem(user.id, request);
  if (problem) return { success: false, error: problem };

  const inputs = describeFormulaInputs(schema);
  if (inputs.length === 0) return { success: false, error: 'This habit has no number fields to calculate from.' };

  const system = calculatedFieldSystem(inputs, user.unitSystem, current);

  const outputSchema = z.object({
    possible: z.boolean().describe('Whether a value from each single entry can give what the user asked for'),
    reason: z.string().optional().describe("When not possible: why, in a short sentence to the user"),
    title: z.string().describe('A short name for the value, e.g. "Pace", "Speed", "Total volume", or for a yes-or-no field what yes means, e.g. "3+ miles"'),
    expression: z.string().describe('The formula, e.g. "duration / distance"'),
    unit: z.string().describe('The unit of the result, e.g. "min/mile", or "" for none'),
    format: z.enum(['number', 'duration']),
  });

  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: google(AI_MODEL),
        maxRetries: 0,
        system,
        prompt: `User request: ${request}${feedback}`,
        schema: outputSchema,
      });
      if (!object.possible) return { success: false, error: object.reason || "That can't be worked out from a single entry." };

      const field = tidyDraftField(object);
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

// The chart part of what generateChart drafts, without the id it gets when saved
export type ChartDraft = Omit<SavedChart, 'id'>;
// Largest chart draft, with its new calculated fields, sent back for a follow-up (see generateChart)
const MAX_CURRENT_CHART_BYTES = 16 * 1024;

// A chart drafted from what the habit's owner asked for (e.g. "miles per week", "my pace over
// time"), with any calculated fields it needs that the habit doesn't have yet (e.g. a pace), for the
// owner to check before it's saved (see saveChart, which gives new fields their final keys).
// `current` is the chart being changed, for a follow-up like "make it monthly", with the calculated
// fields drafted for it that aren't saved yet, which the new draft can use as if they were. The
// returned fields are only those newly drafted. The draft is checked against the habit's fields, and
// the AI is asked once more with the problem if it doesn't work.
export async function generateChart(habitId: string, request: string, current?: { chart: ChartDraft; newCalculatedFields: CalculatedField[] }): Promise<
  { success: true; chart: ChartDraft; newCalculatedFields: CalculatedField[] } | { success: false; error: string }
> {
  const user = await getDefaultUser();
  const habit = await getHabit(habitId);
  if (!habit?.isOwner) return { success: false, error: 'Only the habit\'s owner can add charts.' };
  // The chart being changed comes from the browser; its own checks run on save (see saveChart)
  const problem = (current && jsonBytes(JSON.stringify(current)) > MAX_CURRENT_CHART_BYTES ? 'That chart is too big' : null)
    || await aiRequestProblem(user.id, request);
  if (problem) return { success: false, error: problem };

  const schema = parseHabitSchema(habit.schema);
  // Fields drafted earlier for this chart count as the habit's own
  const existingCalculated = [...parseCalculatedFields(habit.calculatedFields), ...(current?.newCalculatedFields ?? [])];
  const existingFields = plottableFields(schema, existingCalculated);
  const inputs = describeFormulaInputs(schema);

  const system = chartSystem(habit, inputs, existingCalculated, user.unitSystem, current);

  const outputSchema = z.object({
    possible: z.boolean(),
    reason: z.string().optional().describe('When not possible: why, in a short sentence to the user'),
    title: z.string(),
    kind: z.enum(['line', 'bar']),
    layout: z.enum(['shared', 'separate']).describe("With 2 or more series: one axis, or a panel each"),
    period: z.enum(['entry', 'day', 'week', 'month', 'rolling']),
    rollingDays: z.number().int().optional().describe("For period 'rolling': how many days each point covers"),
    series: z.array(z.object({
      field: z.string().describe("A form field key, a calculated field key (existing or new), or 'entries'"),
      fn: z.enum(AGGREGATES).describe("How a period's entries combine, whichever period the chart is shown by"),
    })),
    newCalculatedFields: z.array(z.object({
      key: z.string(),
      title: z.string(),
      expression: z.string(),
      unit: z.string().describe('The unit of the result, or "" for none'),
      format: z.enum(['number', 'duration']),
    })).describe('Values the chart needs that the habit has no field for yet; empty when none are needed'),
  });

  let feedback = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    let object: z.infer<typeof outputSchema>;
    try {
      ({ object } = await generateObject({
        model: google(AI_MODEL),
        maxRetries: 0,
        system,
        prompt: `User request: ${request}${feedback}`,
        schema: outputSchema,
      }));
    } catch (error) {
      console.error('Error generating chart:', error);
      return { success: false, error: 'Failed to make that chart.' };
    }
    if (!object.possible) return { success: false, error: object.reason || "That can't be charted from this habit's fields." };

    const draft = toChartDraft(object);
    const problem = draftProblem(draft, schema, existingCalculated, existingFields.map(f => f.key));
    if (!problem) return { success: true, ...draft };
    feedback = `\n\nYour last answer was ${JSON.stringify(object)}, which doesn't work: ${problem}. Fix it.`;
  }
  return { success: false, error: "Couldn't make a chart for that from this habit's fields." };
}

// The AI's answer as a chart and the calculated fields it adds
function toChartDraft(object: {
  title: string; kind: 'line' | 'bar'; layout: 'shared' | 'separate'; period: 'entry' | 'day' | 'week' | 'month' | 'rolling'; rollingDays?: number;
  series: { field: string; fn: (typeof AGGREGATES)[number] }[];
  newCalculatedFields: { key: string; title: string; expression: string; unit: string; format: 'number' | 'duration' }[];
}) {
  const period = object.period === 'rolling' ? { rollingDays: Math.min(MAX_ROLLING_DAYS, Math.max(2, object.rollingDays ?? 7)) } : object.period;
  const chart: ChartDraft = {
    title: object.title.trim(),
    kind: object.kind,
    layout: object.series.length > 1 ? object.layout : 'shared',
    period,
    series: object.series.slice(0, MAX_SERIES).map(s => ({
      field: s.field === 'entries' ? null : s.field,
      fn: s.field === 'entries' ? 'count' as const : s.fn,
    })),
  };
  const newCalculatedFields = object.newCalculatedFields.map(f => ({ key: f.key.trim(), ...tidyDraftField(f) }));
  return { chart, newCalculatedFields };
}

// A period named in a chart's title, which it shouldn't have (see generateChart)
const PERIOD_IN_TITLE = /\b(per|a|each|every)\s+(day|week|month)\b|\b(daily|weekly|monthly)\b|\b\d+-day\b/i;

// Why a drafted chart doesn't work with the habit, or null when it does
function draftProblem(
  { chart, newCalculatedFields }: { chart: ChartDraft; newCalculatedFields: CalculatedField[] },
  schema: HabitSchema,
  existingCalculated: CalculatedField[],
  existingKeys: string[],
) {
  if (!chart.title) return 'The chart needs a title';
  if (PERIOD_IN_TITLE.test(chart.title)) return `The title "${chart.title}" names a period, but the viewer can switch the chart's period, so leave it out`;
  if (chart.series.length === 0) return 'The chart needs at least one series';
  const usedKeys = [...Object.keys(fieldsOf(schema)), ...existingKeys];
  for (const field of newCalculatedFields) {
    if (usedKeys.includes(field.key)) return `The new calculated field's key "${field.key}" is already used`;
    usedKeys.push(field.key);
    const parsed = calculatedFieldSchema.safeParse(field);
    if (!parsed.success) return `The new calculated field "${field.title}" isn't valid`;
    const problem = calculatedFieldProblem(field, schema);
    if (problem) return `${field.title}: ${problem}`;
  }
  return chartProblem(chart, plottableFields(schema, [...existingCalculated, ...newCalculatedFields]));
}
