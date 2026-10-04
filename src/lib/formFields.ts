import type { HabitSchema } from './types';

// A habit form field as stored in its schema: JSON Schema plus this app's `x-` extensions
export interface FieldSchema {
  type?: string;
  title?: string;
  description?: string;
  enum?: unknown[];
  format?: string;
  'x-widget'?: string;
  'x-unit'?: string;
  [extra: string]: unknown;
}

// The kinds of field the editor builds. Each is a shape of FieldSchema (see propertyFor); `other`
// is anything else a schema can hold (e.g. a date, or a list the AI made), kept as it is.
export const FIELD_TYPES = [
  { id: 'text', label: 'Text' },
  { id: 'longText', label: 'Long text' },
  { id: 'number', label: 'Number' },
  { id: 'integer', label: 'Whole number' },
  { id: 'duration', label: 'Duration' },
  { id: 'boolean', label: 'Yes or no' },
  { id: 'choice', label: 'One of a list' },
] as const;

export type FieldType = (typeof FIELD_TYPES)[number]['id'] | 'other';

// What a field is set to in the editor
export interface FieldSettings {
  title: string;
  type: FieldType;
  // For a number or whole number, e.g. "miles"
  unit: string;
  // For a choice
  choices: string[];
  required: boolean;
}

export function fieldTypeOf(field: FieldSchema): FieldType {
  if (field['x-widget'] === 'duration' && field.type === 'number') return 'duration';
  if (Array.isArray(field.enum) && field.type === 'string') return 'choice';
  if (field.format) return 'other';
  if (field.type === 'string') return field['x-widget'] === 'textarea' ? 'longText' : 'text';
  if (field.type === 'number' || field.type === 'integer' || field.type === 'boolean') return field.type;
  return 'other';
}

// What kind of answer a field takes, in words, e.g. "Number (miles)", "Duration", "One of: Low, High"
export function describeField(field: FieldSchema) {
  const unit = field['x-unit'] ? ` (${field['x-unit']})` : '';
  if (field['x-widget'] === 'duration') return 'Duration';
  if (field['x-widget'] === 'textarea') return 'Long text';
  if (Array.isArray(field.enum) && field.enum.length > 0) return `One of: ${field.enum.join(', ')}`;
  switch (field.type) {
    case 'integer': return `Whole number${unit}`;
    case 'number': return `Number${unit}`;
    case 'boolean': return 'Yes or no';
    case 'array': return 'List';
    case 'string': return field.format === 'date' ? 'Date' : field.format === 'date-time' ? 'Date and time' : 'Text';
    default: return 'Value';
  }
}

export function fieldsOf(schema: HabitSchema) {
  return (schema.properties ?? {}) as Record<string, FieldSchema>;
}

// A field's settings as the editor shows them
export function settingsOf(schema: HabitSchema, key: string): FieldSettings {
  const field = fieldsOf(schema)[key] ?? {};
  return {
    title: field.title || key,
    type: fieldTypeOf(field),
    unit: field['x-unit'] ?? '',
    choices: Array.isArray(field.enum) ? field.enum.map(String) : [],
    required: (schema.required ?? []).includes(key),
  };
}

// A field's schema from its settings. A field kept as the same type keeps whatever else it had
// (e.g. a description); one changed to another type starts over, apart from its description.
export function propertyFor(settings: FieldSettings, previous?: FieldSchema): FieldSchema {
  const title = settings.title.trim();
  if (previous && fieldTypeOf(previous) === settings.type) {
    const kept: FieldSchema = { ...previous, title };
    if (settings.type === 'number' || settings.type === 'integer') {
      if (settings.unit.trim()) kept['x-unit'] = settings.unit.trim();
      else delete kept['x-unit'];
    }
    if (settings.type === 'choice') kept.enum = cleanChoices(settings.choices);
    return kept;
  }

  const base: FieldSchema = { title, ...(previous?.description ? { description: previous.description } : {}) };
  switch (settings.type) {
    case 'text': return { ...base, type: 'string' };
    case 'longText': return { ...base, type: 'string', 'x-widget': 'textarea' };
    case 'number':
    case 'integer': return { ...base, type: settings.type, ...(settings.unit.trim() ? { 'x-unit': settings.unit.trim() } : {}) };
    case 'duration': return { ...base, type: 'number', 'x-widget': 'duration' };
    case 'boolean': return { ...base, type: 'boolean' };
    case 'choice': return { ...base, type: 'string', enum: cleanChoices(settings.choices) };
    // Only reachable for a field that was already `other`, which is kept above
    case 'other': return { ...previous, ...base };
  }
}

function cleanChoices(choices: string[]) {
  return [...new Set(choices.map(c => c.trim()).filter(Boolean))];
}

// A new field's key, from its title: camelCase letters and digits (e.g. "Pages read" -> "pagesRead"),
// and unlike any key the form already has. A key never changes once made, since it's what links
// a field to the values already logged for it.
export function keyFor(title: string, existingKeys: string[]) {
  const words = title.normalize('NFKD').replace(/[^A-Za-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
  let key = words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('') || 'field';
  if (/^\d/.test(key)) key = `field${key}`;
  let unique = key;
  for (let n = 2; existingKeys.includes(unique); n++) unique = `${key}${n}`;
  return unique;
}

// The schema with a field added (`key` null) or changed, in place in the form's order. A new field's
// key also avoids `reservedKeys`, e.g. the habit's calculated fields' keys.
export function withField(schema: HabitSchema, key: string | null, settings: FieldSettings, reservedKeys: string[] = []): { schema: HabitSchema; key: string } {
  const fields = fieldsOf(schema);
  const fieldKey = key ?? keyFor(settings.title, [...Object.keys(fields), ...reservedKeys]);
  const properties = { ...fields, [fieldKey]: propertyFor(settings, key ? fields[key] : undefined) };
  const required = (schema.required ?? []).filter(k => k !== fieldKey);
  if (settings.required) required.push(fieldKey);
  return { schema: { ...schema, properties: properties as HabitSchema['properties'], required }, key: fieldKey };
}

export function withoutField(schema: HabitSchema, key: string): HabitSchema {
  const { [key]: _removed, ...properties } = fieldsOf(schema);
  void _removed;
  return { ...schema, properties: properties as HabitSchema['properties'], required: (schema.required ?? []).filter(k => k !== key) };
}

// Why a field's settings can't be saved yet, or null when they can
export function settingsProblem(settings: FieldSettings) {
  if (!settings.title.trim()) return 'Give the field a name';
  if (settings.type === 'choice' && cleanChoices(settings.choices).length === 0) return 'Add at least one choice';
  return null;
}
