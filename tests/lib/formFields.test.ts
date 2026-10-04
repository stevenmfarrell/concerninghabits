import { describe, expect, it } from 'vitest';
import { fieldTypeOf, keyFor, settingsOf, settingsProblem, withField, withoutField, type FieldSettings } from '@/lib/formFields';
import type { HabitSchema } from '@/lib/types';

const runSchema: HabitSchema = {
  type: 'object',
  properties: {
    distance: { type: 'number', title: 'Distance', 'x-unit': 'miles', description: 'How far' } as HabitSchema,
    time: { type: 'number', title: 'Time', 'x-widget': 'duration' } as HabitSchema,
    day: { type: 'string', title: 'Day', format: 'date' },
  },
  required: ['distance'],
};

const settings = (change: Partial<FieldSettings>): FieldSettings => ({ title: 'Field', type: 'text', unit: '', choices: [], required: false, ...change });

describe('form fields', () => {
  it('reads each field as the editor shows it', () => {
    expect(settingsOf(runSchema, 'distance')).toEqual({ title: 'Distance', type: 'number', unit: 'miles', choices: [], required: true });
    expect(settingsOf(runSchema, 'time').type).toBe('duration');
    expect(settingsOf(runSchema, 'day').type).toBe('other');
    expect(fieldTypeOf({ type: 'string', 'x-widget': 'textarea' })).toBe('longText');
    expect(fieldTypeOf({ type: 'string', enum: ['A'] })).toBe('choice');
  });

  it('adds a field under a new key made from its name, after the others', () => {
    const { schema, key } = withField(runSchema, null, settings({ title: 'Pages read!', type: 'integer', unit: 'pages', required: true }));
    expect(key).toBe('pagesRead');
    expect(Object.keys(schema.properties!)).toEqual(['distance', 'time', 'day', 'pagesRead']);
    expect(schema.properties!.pagesRead).toEqual({ title: 'Pages read!', type: 'integer', 'x-unit': 'pages' });
    expect(schema.required).toEqual(['distance', 'pagesRead']);
  });

  it('makes keys unique and valid', () => {
    expect(keyFor('Distance', ['distance'])).toBe('distance2');
    expect(keyFor('🏃', [])).toBe('field');
    expect(keyFor('5k time', [])).toBe('field5kTime');
  });

  it('keeps a field\'s key, place, and other settings when it\'s renamed', () => {
    const { schema, key } = withField(runSchema, 'distance', { ...settingsOf(runSchema, 'distance'), title: 'Kilometers', unit: 'km', required: false });
    expect(key).toBe('distance');
    expect(Object.keys(schema.properties!)).toEqual(['distance', 'time', 'day']);
    expect(schema.properties!.distance).toEqual({ type: 'number', title: 'Kilometers', 'x-unit': 'km', description: 'How far' });
    expect(schema.required).toEqual([]);
  });

  it('starts a field over, apart from its description, when its type changes', () => {
    const { schema } = withField(runSchema, 'distance', settings({ title: 'Distance', type: 'choice', choices: [' Short ', '', 'Long', 'Long'] }));
    expect(schema.properties!.distance).toEqual({ title: 'Distance', description: 'How far', type: 'string', enum: ['Short', 'Long'] });
  });

  it('keeps a field of a kind the editor doesn\'t build as it is', () => {
    const { schema } = withField(runSchema, 'day', { ...settingsOf(runSchema, 'day'), title: 'Date' });
    expect(schema.properties!.day).toEqual({ type: 'string', title: 'Date', format: 'date' });
  });

  it('removes a field and its required mark', () => {
    const schema = withoutField(runSchema, 'distance');
    expect(Object.keys(schema.properties!)).toEqual(['time', 'day']);
    expect(schema.required).toEqual([]);
  });

  it('needs a name, and a choice needs a choice', () => {
    expect(settingsProblem(settings({ title: ' ' }))).toBe('Give the field a name');
    expect(settingsProblem(settings({ type: 'choice', choices: [''] }))).toBe('Add at least one choice');
    expect(settingsProblem(settings({}))).toBeNull();
  });

  it("gives a new field a key unlike the habit's calculated fields' keys", () => {
    const { key } = withField(runSchema, null, settings({ title: 'Pace', type: 'number' }), ['pace']);
    expect(key).toBe('pace2');
  });
});
