import { z } from 'zod';
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from './constants';
import type { HabitSchema } from './types';

// Bounds on a habit's form definition, which everyone the habit is shared with renders, every entry
// is checked against, and AI requests for the habit include
export const MAX_FORM_FIELDS = 50;
export const MAX_CHOICES = 50;
const MAX_UNIT_LENGTH = 40;
const MAX_HABIT_SCHEMA_BYTES = 16 * 1024;

// A field as the editor or the AI makes it (see FieldSchema). Other JSON Schema keywords are kept,
// within the overall size cap, since a field the AI made can hold e.g. a date format or a list.
const fieldSchema = z.looseObject({
  type: z.enum(['string', 'number', 'integer', 'boolean', 'array']).optional(),
  title: z.string().max(MAX_NAME_LENGTH, `Field names must be ${MAX_NAME_LENGTH} characters or fewer`).optional(),
  description: z.string().max(MAX_DESCRIPTION_LENGTH).optional(),
  enum: z.array(z.union([z.string().max(MAX_NAME_LENGTH, `Choices must be ${MAX_NAME_LENGTH} characters or fewer`), z.number(), z.boolean()]))
    .max(MAX_CHOICES, `A field can have at most ${MAX_CHOICES} choices`).optional(),
  format: z.string().max(40).optional(),
  'x-widget': z.string().max(40).optional(),
  'x-unit': z.string().max(MAX_UNIT_LENGTH, `Units must be ${MAX_UNIT_LENGTH} characters or fewer`).optional(),
});

// Loose at the top level too: older habits' schemas carry keys like `category` and `frequency`
const habitSchemaSchema = z.looseObject({
  type: z.literal('object').optional(),
  title: z.string().max(MAX_NAME_LENGTH).optional(),
  properties: z.record(z.string().min(1).max(64), fieldSchema)
    .refine(fields => Object.keys(fields).length <= MAX_FORM_FIELDS, `A form can have at most ${MAX_FORM_FIELDS} fields`)
    .optional(),
  required: z.array(z.string().max(64)).max(MAX_FORM_FIELDS).optional(),
  enableVoice: z.boolean().optional(),
  enablePhoto: z.boolean().optional(),
});

// Why a habit's form definition can't be saved (or sent to the AI), or null when it can. Checked on
// the server, since it comes from the browser.
export function habitSchemaProblem(schema: unknown): string | null {
  const json = JSON.stringify(schema ?? {});
  if (jsonBytes(json) > MAX_HABIT_SCHEMA_BYTES) return 'This form is too big to save';
  const parsed = habitSchemaSchema.safeParse(schema ?? {});
  return parsed.success ? null : parsed.error.issues[0]?.message ?? 'This form isn\'t valid';
}

export function jsonBytes(json: string) {
  return new TextEncoder().encode(json).length;
}

// A habit's form definition from its stored JSON (Habit.schema), or an empty one if it isn't valid.
// Its fields are fieldsOf(schema).
export function parseHabitSchema(raw: string | null | undefined): HabitSchema {
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// An entry's values from their stored JSON (HabitLog.payload), keyed by form field, or null if
// they aren't valid: written by the app, but a bad row shouldn't take down a page that lists it
export function parseEntryValues(raw: string | null | undefined): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw ?? '');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
