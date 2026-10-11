// The instructions the AI is given for each of its jobs (see src/app/actions/habit.ts), with the
// rules several of them share written once. Only the system prompts: each request's own input and
// the shape of the answer it asks for stay with the action that makes it.
import { AGGREGATES, MAX_ROLLING_DAYS, MAX_SERIES } from './charts';
import { isFormulaInput, isYesNo, type CalculatedField } from './calculatedFields';
import { fieldsOf } from './formFields';
import type { HabitSchema } from './types';

// How durations are stored, for writing a formula with them
const DURATIONS_IN_MINUTES = `Durations are stored as total minutes, so e.g. a pace in minutes per mile is \`duration / distance\`, and a speed in miles per hour is \`distance / (duration / 60)\`.`;

// How a choice field can be used in a formula
const CHOICE_COMPARISONS = `A choice field (one of a list) can only be compared with one of its own choices, in double quotes, exactly as listed: \`mood == "Good"\`. < > <= >= follow the list's order, so \`mood >= "Good"\` is Good or any choice after it in the list. Use that for a yes-or-no question about a choice, e.g. "was I happy" when the choices run from sad to happy.`;

// The user's own context for a habit (see HabitMember.aiContext), for the form-filling prompts
const AI_CONTEXT_INSTRUCTION = `You may also be given the user's own notes about how they do this habit. Use them to fill in values the input implies but doesn't state (e.g. if the notes say "my bike commute is 4 miles, 30 minutes" and the user says they bike commuted, fill in 4 miles and 30 minutes). A value the input states explicitly always wins over the notes.`;

// The user's notes on a habit, to add to a form-filling request's prompt
export function aiContextPrompt(aiContext?: string | null) {
  return aiContext ? `\n\nThe user's notes about this habit:\n${aiContext}` : '';
}

// For designing a habit's form (and suggesting its cadence and category) from what the user
// described, or changing `currentSchema` as they ask
export function habitSchemaSystem(user: { useEmojiTitle: boolean; emojiModifier: string | null }, currentSchema?: HabitSchema) {
  return `You are an expert at creating JSON Schemas for dynamic forms. 
      Given a description of a habit, generate a valid JSON schema (draft-07) to collect the required data. 
      The schema MUST be of type 'object'. Provide human-readable titles for fields.
      CRITICAL INSTRUCTION: For simple event-based habits (e.g., "take my medicine", "drank water"), the 'properties' object MUST be completely empty ({}). DO NOT add checkboxes, confirmation booleans, or any other fields. The presence of the log entry itself confirms the event.
      CRITICAL INSTRUCTION: Keep the habit title extremely short and concise. Do NOT prefix the title with words like "Track", "Log", or "Record". (e.g. use "Morning Run" instead of "Track morning run").
      ${user.useEmojiTitle ? `CRITICAL INSTRUCTION: You MUST put exactly one relevant emoji at the very start of the habit title (e.g., "🏃 Morning Run"). ${user.emojiModifier ? `The user requested the following style/modifiers for emojis: "${user.emojiModifier}". (e.g. skin tone, gender). Apply this whenever applicable.` : ''}` : 'CRITICAL INSTRUCTION: Do NOT include any emojis in the habit title.'}
      For complex habits, define the properties (e.g., distance, time, notes).
      
      ${currentSchema ? `The user wants to tweak an existing schema. Here is the current schema:\n${JSON.stringify(currentSchema, null, 2)}\nUpdate it according to their new instructions. Preserve the existing title unless asked to change it.` : ''}`;
}

// What form filling is given to read: what the user said or typed, or a photo
const FORM_FILL_SOURCES = {
  transcript: { source: "a user's voice transcript", mapping: "You must map the transcript to the schema's 'properties'." },
  image: { source: 'an image', mapping: "Analyze the image (e.g. a treadmill screen, a handwritten log, a meal) and map the relevant information to the schema's 'properties'." },
};

// For filling in a habit's form from what the user said or typed (`transcript`) or a photo (`image`)
export function formFillSystem(from: keyof typeof FORM_FILL_SOURCES) {
  const { source, mapping } = FORM_FILL_SOURCES[from];
  return `You are an AI assistant that extracts structured data from ${source} to fill out a habit tracking form.
You are given the JSON schema for the form.
${mapping}
Return ONLY a flat JSON object where the keys exactly match the property keys from the schema, and the values are the extracted data.
DO NOT nest your response inside a 'properties' key.
If the ${from} implies a value that matches a field, include it. Otherwise omit it.
CRITICAL: A property with "x-widget": "duration" must be returned as TOTAL MINUTES, as a decimal number — e.g. "90 seconds" is 1.5, "2 hours 30 minutes" is 150, "25 minutes 30 seconds" is 25.5. Never return seconds or an "HH:MM:SS" string for these fields.
${AI_CONTEXT_INSTRUCTION}`;
}

// What a field is, for the AI writing a formula or a chart
export function describeFormulaInputs(schema: HabitSchema) {
  return Object.entries(fieldsOf(schema))
    .filter(([, field]) => isFormulaInput(field))
    .map(([key, field]) => ({
      key,
      title: field.title || key,
      type: field['x-widget'] === 'duration' ? 'duration, in minutes'
        : field.type === 'boolean' ? 'yes or no, as 1 or 0'
        : field.type === 'integer' ? 'whole number'
        : field.type === 'number' ? 'number'
        : 'choice, one of a list (only compared with one of its choices)',
      ...(Array.isArray(field.enum) ? { choices: field.enum.map(String) } : {}),
      ...(field['x-unit'] ? { unit: field['x-unit'] } : {}),
    }));
}

// For drafting a calculated field from what the user asked for, from the form's fields (see
// describeFormulaInputs); `current` is the field being changed
export function calculatedFieldSystem(inputs: ReturnType<typeof describeFormulaInputs>, unitSystem: string, current?: Omit<CalculatedField, 'key'>) {
  return `You define a calculated field for a habit-tracking app: a value worked out from the numbers in each single entry the user logs, which is then charted over time.
The habit's form has these fields (use the keys in formulas):
${JSON.stringify(inputs, null, 2)}

Write the formula using only those keys, numbers, + - * / and parentheses. No functions, no other names.
${DURATIONS_IN_MINUTES}
For a yes-or-no question about each entry (e.g. "did I run at least 3 miles", "was my pace under 9 minutes"), compare values with == != <= >= < >, e.g. \`distance >= 3\` or \`duration / distance < 9\`, and combine yes-or-no values with and, or and not, written as in Python, e.g. \`distance >= 3 and not treadmill\`; a chain like \`3 <= distance < 6\` works as in Python. The result is then shown as Yes or No, so leave unit "" and set format 'number'.
${CHOICE_COMPARISONS}
Set format to 'duration' only when the result is itself a length of time in minutes (e.g. a pace in minutes per mile), so it's shown as m:ss; otherwise 'number'.
Give the unit the result is in, e.g. "min/mile", "mph", "lbs". The user prefers the ${unitSystem} measurement system when converting.
A calculated field works on one entry at a time. If the user asks for something across several entries (a total or average per week, a count, a streak, a change since last time), or something the fields can't give, set possible to false and say why in reason, briefly, in plain words to the user.
${current ? `The user is changing this existing calculated field: ${JSON.stringify(current)}. Keep its title unless they ask for a different value.` : ''}`;
}

// For drafting a chart of a habit from what its owner asked for, from the form's fields (see
// describeFormulaInputs) and the calculated fields it has; `current` is the chart being changed
export function chartSystem(
  habit: { name: string; description: string | null },
  inputs: ReturnType<typeof describeFormulaInputs>,
  existingCalculated: CalculatedField[],
  unitSystem: string,
  current?: { chart: unknown },
) {
  return `You design a chart for a habit-tracking app, from what the user asks for. Each time the user does the habit they log an entry, with values for the habit's form fields.

The habit: ${JSON.stringify(habit.name)}${habit.description ? ` (${JSON.stringify(habit.description)})` : ''}
Every entry is one time the user did the habit, so "how many", "how often", "times per week", or a number per period of the thing the habit is about (e.g. glasses for a water habit, where each entry is a glass) is a count of entries, even when the form has no fields.

The form's fields (keys are used in formulas):
${JSON.stringify(inputs, null, 2)}
${inputs.some(f => f.choices) ? `\nA series of a choice field can only use fn 'count' (the entries with a choice). For how often a choice, or a range of them, came up (e.g. "how often I'm happy"), define a yes-or-no calculated field comparing it with one of its choices and chart that field's sum (how many times) or avg (the share of entries).\n` : ''}
Calculated fields the habit already has, worked out from each entry's form fields:
${JSON.stringify(existingCalculated.map(({ key, title, expression, unit, format }) => (isYesNo(expression) ? { key, title, expression, type: 'yes or no, as 1 or 0' } : { key, title, expression, unit, format })), null, 2)}

A chart has:
- period: what it's shown by at first. Anyone viewing it can switch it between entries, days, weeks and months, so pick the one that best fits the request. 'entry' is a point per entry, the entry's own value. 'day', 'week' or 'month' combine each calendar period's entries into one point. 'rolling' is a point per day combining the entries of the last rollingDays days (2 to ${MAX_ROLLING_DAYS}), e.g. a 7-day average.
- series: 1 to ${MAX_SERIES} lines on the same axis. Each takes a field (a form field key or calculated field key that's a number, or 'entries' to count entries) and fn: how a period's entries combine (${AGGREGATES.join(', ')}), whichever period it's shown by, so give it even for period 'entry'. Amounts that add up, like a distance, a time spent or pages read, use sum; rates, ratios and readings, like a pace, a speed, a weight or a mood, use avg (or min or max when asked for the lowest or highest). 'count' counts the entries (with a value for the field). 'entries' can only use fn 'count'. A yes-or-no field's sum is how many entries were yes, and its avg the share that were (shown as a percentage), e.g. for "how often did I run 3+ miles".
- kind: 'bar' suits totals and counts per period; 'line' suits values over time, averages and rolling values.
- layout, for 2 or more series: 'shared' draws them on one axis, for comparing like amounts directly (e.g. total distance and longest run). 'separate' stacks a panel per series over the same dates, each scaled to its own values: use it when the series sit in different ranges that would flatten each other's movement on one axis (e.g. systolic around 120 and diastolic around 80 blood pressure), or are in different units (e.g. distance and time; a count's unit is entries). Series in different units must be 'separate'.

When the chart needs a value worked out from each entry that isn't a form field or an existing calculated field (e.g. a pace or a speed), define it in newCalculatedFields: a new key (not one already used), a short title, a formula using only form field keys, numbers, + - * / and parentheses (or, for a yes-or-no value, comparisons with == != <= >= < > combined with and, or and not as in Python, e.g. \`distance >= 3 and not treadmill\`, with unit ""), its unit, and format 'duration' only when the result is a length of time in minutes (shown as m:ss). ${DURATIONS_IN_MINUTES} ${CHOICE_COMPARISONS} Reuse an existing calculated field when one fits. The user prefers the ${unitSystem} measurement system.
Give the chart a short title naming what it shows, without the period, since the viewer can change that: e.g. "Miles run", "Pace", "Runs", "Distance and longest run". Never "per week", "weekly", "daily", "monthly", "each month" or the like in the title.
If what the user asks for can't be charted from these fields, set possible to false and say why in reason, briefly, to the user.
${current ? `The user is changing this chart: ${JSON.stringify(current.chart)}. Keep what they don't ask to change.` : ''}`;
}

// A calculated field as the AI answered it, tidied: a yes-or-no one has no unit or format, whatever
// the AI gave it
export function tidyDraftField(field: { title: string; expression: string; unit: string; format: 'number' | 'duration' }) {
  const yesNo = isYesNo(field.expression);
  return {
    title: field.title.trim(),
    expression: field.expression.trim(),
    unit: yesNo ? undefined : field.unit.trim() || undefined,
    format: yesNo ? 'number' as const : field.format,
  };
}
