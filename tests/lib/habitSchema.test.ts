import { describe, expect, it } from 'vitest';
import { habitSchemaProblem, MAX_CHOICES, MAX_FORM_FIELDS, parseEntryValues, parseHabitSchema } from '@/lib/habitSchema';

const fields = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`field${i}`, { type: 'number', title: `Field ${i}` }]));

describe('habitSchemaProblem', () => {
  it('accepts forms as the editor and the AI make them, including older habits\' extra keys', () => {
    expect(habitSchemaProblem({
      title: '🏋️ Squats', category: 'Body', frequency: 'daily', type: 'object',
      properties: {
        sets: { type: 'number', title: 'Sets', 'x-unit': 'sets' },
        time: { type: 'number', title: 'Time', 'x-widget': 'duration' },
        mood: { type: 'string', title: 'Mood', enum: ['Low', 'High'] },
        day: { type: 'string', format: 'date' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['sets'], enableVoice: true, enablePhoto: false,
    })).toBeNull();
    expect(habitSchemaProblem({})).toBeNull();
    expect(habitSchemaProblem(undefined)).toBeNull();
  });

  it('caps fields, choices, names and units', () => {
    expect(habitSchemaProblem({ properties: fields(MAX_FORM_FIELDS) })).toBeNull();
    expect(habitSchemaProblem({ properties: fields(MAX_FORM_FIELDS + 1) })).toMatch(/at most 50 fields/);
    expect(habitSchemaProblem({ properties: { a: { type: 'string', enum: Array.from({ length: MAX_CHOICES + 1 }, (_, i) => `c${i}`) } } })).toMatch(/choices/);
    expect(habitSchemaProblem({ properties: { a: { type: 'number', title: 'x'.repeat(101) } } })).toMatch(/Field names/);
    expect(habitSchemaProblem({ properties: { a: { type: 'number', 'x-unit': 'x'.repeat(41) } } })).toMatch(/Units/);
  });

  it('rejects field types the app can\'t show, and oversized forms', () => {
    expect(habitSchemaProblem({ properties: { a: { type: 'null' } } })).not.toBeNull();
    expect(habitSchemaProblem({ properties: { a: 'not a field' } })).not.toBeNull();
    expect(habitSchemaProblem({ properties: { a: { type: 'string', default: 'x'.repeat(20_000) } } })).toBe('This form is too big to save');
  });
});

describe('parseHabitSchema', () => {
  it('reads a stored form, and falls back to an empty one for anything else', () => {
    expect(parseHabitSchema('{"type":"object","properties":{"miles":{"type":"number"}}}')).toEqual({ type: 'object', properties: { miles: { type: 'number' } } });
    expect(parseHabitSchema('')).toEqual({});
    expect(parseHabitSchema(null)).toEqual({});
    expect(parseHabitSchema('not json')).toEqual({});
    expect(parseHabitSchema('[1, 2]')).toEqual({});
    expect(parseHabitSchema('null')).toEqual({});
  });
});

describe('parseEntryValues', () => {
  it('reads an entry\'s values, or null when they aren\'t an object', () => {
    expect(parseEntryValues('{"miles":3}')).toEqual({ miles: 3 });
    expect(parseEntryValues('{}')).toEqual({});
    expect(parseEntryValues('not json')).toBeNull();
    expect(parseEntryValues('')).toBeNull();
    expect(parseEntryValues('[3]')).toBeNull();
    expect(parseEntryValues('null')).toBeNull();
  });
});
