import type { UiSchema } from '@rjsf/utils';
import type { FieldSchema } from '@/lib/formFields';
import DurationWidget from './DurationWidget';
import UnitWidget from './UnitWidget';

// The custom widgets every habit form renders with
export const HABIT_FORM_WIDGETS = { duration: DurationWidget, unit: UnitWidget };

// A field's name for people: its schema title, or else its key spelled out ("totalMinutes" ->
// "Total Minutes"), so every view of an entry names a field the same way
export function fieldTitle(key: string, properties: Record<string, FieldSchema> | undefined) {
  return properties?.[key]?.title || key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, c => c.toUpperCase());
}

// Picks each field's widget from its `x-` extensions: a duration picker, a multi-line text box for
// free-form writing (e.g. notes), or a number with its unit
export function habitFormUiSchema(properties: Record<string, FieldSchema> | undefined): UiSchema {
  const uiSchema: UiSchema = {};
  for (const [key, prop] of Object.entries(properties ?? {})) {
    if (prop['x-widget'] === 'duration') uiSchema[key] = { 'ui:widget': 'duration' };
    else if (prop['x-widget'] === 'textarea') uiSchema[key] = { 'ui:widget': 'textarea', 'ui:options': { rows: 4 } };
    else if (prop['x-unit']) uiSchema[key] = { 'ui:widget': 'unit' };
  }
  return uiSchema;
}
