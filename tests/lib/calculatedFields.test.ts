import { describe, expect, it } from 'vitest';
import {
  calculateValue,
  calculatedFieldProblem,
  calculatedFieldsSchema,
  describeExpression,
  evaluate,
  expressionProblem,
  fieldsUsed,
  parseCalculatedFields,
  parseExpression,
} from '@/lib/calculatedFields';
import type { HabitSchema } from '@/lib/types';

const runSchema: HabitSchema = {
  type: 'object',
  properties: {
    distance: { type: 'number', title: 'Distance', 'x-unit': 'miles' } as HabitSchema,
    duration: { type: 'number', title: 'Duration', 'x-widget': 'duration' } as HabitSchema,
    treadmill: { type: 'boolean', title: 'Treadmill' },
    notes: { type: 'string', title: 'Notes' },
  },
};

const value = (source: string, values: Record<string, unknown> = {}) => evaluate(parseExpression(source), values);

describe('formulas', () => {
  it('works out arithmetic with the usual precedence', () => {
    expect(value('1 + 2 * 3')).toBe(7);
    expect(value('(1 + 2) * 3')).toBe(9);
    expect(value('10 - 4 - 3')).toBe(3);
    expect(value('24 / 4 / 2')).toBe(3);
    expect(value('-2 * -3')).toBe(6);
    expect(value('.5 + 1.25')).toBe(1.75);
  });

  it('reads fields from the entry, counting yes or no as 1 or 0', () => {
    expect(value('duration / distance', { duration: 30, distance: 3 })).toBe(10);
    expect(value('distance / (duration / 60)', { duration: 30, distance: 3 })).toBe(6);
    expect(value('treadmill * distance', { treadmill: true, distance: 3 })).toBe(3);
    expect(value('treadmill * distance', { treadmill: false, distance: 3 })).toBe(0);
  });

  it('has no value when a field is missing or not a number, or it divides by zero', () => {
    expect(value('duration / distance', { duration: 30 })).toBeNull();
    expect(value('duration / distance', { duration: 30, distance: '3' })).toBeNull();
    expect(value('duration / distance', { duration: 30, distance: 0 })).toBeNull();
  });

  it('says what is wrong with a formula that does not read', () => {
    expect(expressionProblem('duration / distance')).toBeNull();
    expect(expressionProblem('')).toMatch(/empty/);
    expect(expressionProblem('duration /')).toMatch(/ends too soon/);
    expect(expressionProblem('(duration / distance')).toMatch(/missing its "\)"/);
    expect(expressionProblem('duration distance')).toMatch(/Unexpected "distance"/);
    expect(expressionProblem('distance % 2')).toMatch(/"%" can't be used/);
    expect(expressionProblem('Math.max(1)')).toMatch(/Unexpected/);
    expect(expressionProblem('duration ** 2')).toMatch(/Unexpected/);
  });

  it('lists the fields a formula uses once each', () => {
    expect(fieldsUsed(parseExpression('distance / (duration / 60) + distance'))).toEqual(['distance', 'duration']);
  });

  it('rounds a calculated value to two places, and has none for a formula that does not read', () => {
    expect(calculateValue('duration / distance', { duration: 28, distance: 3 })).toBe(9.33);
    expect(calculateValue('duration /', { duration: 28 })).toBeNull();
  });
});

describe('calculated fields', () => {
  it('checks a formula against the form', () => {
    expect(calculatedFieldProblem({ expression: 'duration / distance' }, runSchema)).toBeNull();
    expect(calculatedFieldProblem({ expression: 'duration / pace' }, runSchema)).toBe('Uses "pace", which the form doesn\'t have');
    expect(calculatedFieldProblem({ expression: 'notes * 2' }, runSchema)).toBe("Uses Notes, which isn't a number");
    expect(calculatedFieldProblem({ expression: 'duration /' }, runSchema)).toMatch(/ends too soon/);
  });

  it('describes a formula with field names, bracketing only where needed', () => {
    expect(describeExpression('duration / distance', runSchema)).toBe('Duration ÷ Distance');
    expect(describeExpression('distance / (duration / 60)', runSchema)).toBe('Distance ÷ (Duration ÷ 60)');
    expect(describeExpression('(distance * 2) + 1', runSchema)).toBe('Distance × 2 + 1');
    expect(describeExpression('distance - (duration - 1)', runSchema)).toBe('Distance − (Duration − 1)');
    expect(describeExpression('oops /', runSchema)).toBe('oops /');
  });

  it('reads stored fields, dropping anything unreadable', () => {
    const stored = JSON.stringify([
      { key: 'pace', title: 'Pace', expression: 'duration / distance', unit: 'min/mile', format: 'duration' },
      { key: 'bad key', title: 'Bad', expression: '1' },
      'nonsense',
    ]);
    expect(parseCalculatedFields(stored)).toEqual([{ key: 'pace', title: 'Pace', expression: 'duration / distance', unit: 'min/mile', format: 'duration' }]);
    expect(parseCalculatedFields('not json')).toEqual([]);
    expect(parseCalculatedFields(null)).toEqual([]);
  });

  it('rejects a list with a shared key or a formula that does not read', () => {
    const pace = { key: 'pace', title: 'Pace', expression: 'duration / distance', format: 'number' as const };
    expect(calculatedFieldsSchema.safeParse([pace]).success).toBe(true);
    expect(calculatedFieldsSchema.safeParse([pace, pace]).success).toBe(false);
    expect(calculatedFieldsSchema.safeParse([{ ...pace, expression: 'duration +' }]).success).toBe(false);
  });
});
