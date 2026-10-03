import type { UiSchema } from '@rjsf/utils';
import type { HabitSchema } from '@/lib/types';
import DurationWidget from './DurationWidget';
import UnitWidget from './UnitWidget';

// A habit form field as this app's schemas describe it: JSON Schema plus our `x-` extensions
export type HabitFormProperties = Record<string, { type?: string; title?: string; 'x-widget'?: string; 'x-unit'?: string }>;

// The custom widgets every habit form renders with
export const HABIT_FORM_WIDGETS = { duration: DurationWidget, unit: UnitWidget };

export function parseHabitSchema(rawSchema: string): HabitSchema {
  try {
    return JSON.parse(rawSchema);
  } catch {
    return {};
  }
}

// Picks each field's widget from its `x-` extensions: a duration picker, or a number with its unit
export function habitFormUiSchema(properties: HabitFormProperties | undefined): UiSchema {
  const uiSchema: UiSchema = {};
  for (const [key, prop] of Object.entries(properties ?? {})) {
    if (prop['x-widget'] === 'duration') uiSchema[key] = { 'ui:widget': 'duration' };
    else if (prop['x-unit']) uiSchema[key] = { 'ui:widget': 'unit' };
  }
  return uiSchema;
}
