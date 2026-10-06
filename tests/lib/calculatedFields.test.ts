import { describe, expect, it } from 'vitest';
import {
  calculateValue,
  calculatedFieldProblem,
  calculatedFieldsSchema,
  choiceLists,
  describeExpression,
  evaluate,
  expressionProblem,
  fieldsUsed,
  isYesNo,
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

  it('compares two values as yes (1) or no (0), after the arithmetic on each side', () => {
    expect(value('distance >= 3', { distance: 3 })).toBe(1);
    expect(value('distance > 3', { distance: 3 })).toBe(0);
    expect(value('distance < 3', { distance: 2.5 })).toBe(1);
    expect(value('distance <= 3', { distance: 3.5 })).toBe(0);
    expect(value('distance == 3', { distance: 3 })).toBe(1);
    expect(value('duration / distance < 9', { duration: 27, distance: 3.1 })).toBe(1);
    expect(value('treadmill == 0', { treadmill: false })).toBe(1);
    expect(value('distance >= 3', {})).toBeNull();
  });

  it('counts values equal within rounding as equal', () => {
    expect(value('0.1 + 0.2 == 0.3')).toBe(1);
    expect(value('0.1 + 0.2 <= 0.3')).toBe(1);
    expect(value('0.1 + 0.2 > 0.3')).toBe(0);
  });

  it('counts a comparison in brackets as 1 or 0 in arithmetic', () => {
    expect(value('(distance >= 3) + (duration >= 30)', { distance: 4, duration: 20 })).toBe(1);
  });

  it('compares with == for equals and != for not equal', () => {
    expect(value('distance != 3', { distance: 3 })).toBe(0);
    expect(value('distance != 3', { distance: 4 })).toBe(1);
    expect(expressionProblem('distance = 3')).toMatch(/Use ==/);
    expect(expressionProblem('distance ! 3')).toMatch(/Use ==/);
    expect(expressionProblem('distance =< 3')).toMatch(/Use ==/);
    expect(expressionProblem('distance >=')).toMatch(/ends too soon/);
  });

  it('reads a chain of comparisons as Python does, each pair in turn', () => {
    expect(value('1 < distance < 5', { distance: 3 })).toBe(1);
    expect(value('1 < distance < 5', { distance: 5 })).toBe(0);
    expect(value('1 < distance < 5', { distance: 0 })).toBe(0);
    expect(value('0 <= distance <= duration < 60', { distance: 3, duration: 30 })).toBe(1);
    expect(value('0 <= distance <= duration < 60', { distance: 3, duration: 2 })).toBe(0);
  });

  it('combines yes or no with not, and and or, in that order of precedence after comparisons', () => {
    expect(value('distance >= 3 and duration < 30', { distance: 3, duration: 25 })).toBe(1);
    expect(value('distance >= 3 and duration < 30', { distance: 3, duration: 35 })).toBe(0);
    expect(value('distance >= 3 or duration < 30', { distance: 1, duration: 25 })).toBe(1);
    expect(value('not distance >= 3', { distance: 1 })).toBe(1);
    expect(value('not treadmill and distance > 1', { treadmill: false, distance: 2 })).toBe(1);
    // or binds loosest: a or (b and c)
    expect(value('treadmill or distance > 5 and duration > 60', { treadmill: true, distance: 1, duration: 1 })).toBe(1);
    expect(value('(treadmill or distance > 5) and duration > 60', { treadmill: true, distance: 1, duration: 1 })).toBe(0);
    // Anything but 0 is yes
    expect(value('distance and duration', { distance: 2, duration: 0 })).toBe(0);
    expect(value('not not distance', { distance: 2 })).toBe(1);
  });

  it('only has no value from a missing one when it matters', () => {
    expect(value('treadmill or distance > 3', { treadmill: true })).toBe(1);
    expect(value('treadmill or distance > 3', { treadmill: false })).toBeNull();
    expect(value('treadmill and distance > 3', { treadmill: false })).toBe(0);
    expect(value('treadmill and distance > 3', { treadmill: true })).toBeNull();
    expect(value('not distance > 3', {})).toBeNull();
  });

  it('says what is wrong with and, or and not used wrongly', () => {
    expect(expressionProblem('distance > 3 and')).toMatch(/ends too soon/);
    expect(expressionProblem('and distance > 3')).toMatch(/Unexpected "and"/);
    expect(expressionProblem('distance not 3')).toMatch(/Unexpected "not"/);
  });

  it('knows a formula whose result is a comparison gives yes or no', () => {
    expect(isYesNo('distance >= 3')).toBe(true);
    expect(isYesNo('(distance >= 3)')).toBe(true);
    expect(isYesNo('(distance >= 3) + 1')).toBe(false);
    expect(isYesNo('duration / distance')).toBe(false);
    expect(isYesNo('distance >=')).toBe(false);
    expect(isYesNo('distance > 3 or treadmill')).toBe(true);
    expect(isYesNo('not treadmill')).toBe(true);
    expect(isYesNo('1 < distance < 5')).toBe(true);
  });

  it('lists the fields a formula uses once each', () => {
    expect(fieldsUsed(parseExpression('distance / (duration / 60) + distance'))).toEqual(['distance', 'duration']);
  });

  it('rounds a calculated value to two places, and has none for a formula that does not read', () => {
    expect(calculateValue('duration / distance', { duration: 28, distance: 3 })).toBe(9.33);
    expect(calculateValue('duration /', { duration: 28 })).toBeNull();
  });
});

describe('comparing a choice field', () => {
  const moodSchema: HabitSchema = {
    type: 'object',
    properties: {
      mood: { type: 'string', title: 'Mood', enum: ['Rough', 'Meh', 'Okay', 'Good', 'Great'] },
      hours: { type: 'number', title: 'Hours' },
      notes: { type: 'string', title: 'Notes' },
    },
  };
  const choices = choiceLists(moodSchema);
  const happy = (source: string, mood: unknown) => calculateValue(source, { mood }, choices);

  it("lists the form's choice fields' choices", () => {
    expect(choices).toEqual({ mood: ['Rough', 'Meh', 'Okay', 'Good', 'Great'] });
  });

  it("compares a choice by its place in the list, either way round", () => {
    expect(happy('mood == "Good"', 'Good')).toBe(1);
    expect(happy("mood == 'Good'", 'Great')).toBe(0);
    expect(happy('mood >= "Good"', 'Great')).toBe(1);
    expect(happy('mood >= "Good"', 'Okay')).toBe(0);
    expect(happy('"Okay" > mood', 'Meh')).toBe(1);
    expect(happy('(mood >= "Good") + 1', 'Good')).toBe(2);
    expect(happy('"Meh" <= mood <= "Okay"', 'Okay')).toBe(1);
    expect(happy('"Meh" <= mood <= "Okay"', 'Good')).toBe(0);
    expect(happy('mood == "Rough" or mood == "Great"', 'Great')).toBe(1);
    expect(happy('mood != "Rough"', 'Meh')).toBe(1);
  });

  it('has no value for an entry without a choice, or with one no longer in the list', () => {
    expect(happy('mood >= "Good"', undefined)).toBeNull();
    expect(happy('mood >= "Good"', 'Ecstatic')).toBeNull();
  });

  it('only compares a choice field with one of its own choices', () => {
    expect(calculatedFieldProblem({ expression: 'mood >= "Good"' }, moodSchema)).toBeNull();
    expect(calculatedFieldProblem({ expression: 'mood == "Good" and hours > 7' }, moodSchema)).toBeNull();
    expect(calculatedFieldProblem({ expression: 'not mood' }, moodSchema)).toMatch(/Mood is one of a list/);
    expect(calculatedFieldProblem({ expression: 'hours > 7 and "Good"' }, moodSchema)).toMatch(/can only be compared with a choice field/);
    expect(calculatedFieldProblem({ expression: 'mood == "Fine"' }, moodSchema)).toBe(`"Fine" isn't one of Mood's choices (Rough, Meh, Okay, Good, Great)`);
    expect(calculatedFieldProblem({ expression: 'mood * 2' }, moodSchema)).toMatch(/Mood is one of a list/);
    expect(calculatedFieldProblem({ expression: 'mood > 2' }, moodSchema)).toMatch(/Mood is one of a list/);
    expect(calculatedFieldProblem({ expression: 'hours == "Good"' }, moodSchema)).toMatch(/can only be compared with a choice field/);
    expect(calculatedFieldProblem({ expression: '"Good"' }, moodSchema)).toMatch(/can only be compared with a choice field/);
    expect(calculatedFieldProblem({ expression: 'notes == "x"' }, moodSchema)).toBe("Uses Notes, which isn't a number");
    expect(expressionProblem('mood == "Good')).toMatch(/missing its closing/);
  });

  it('describes a choice comparison with the choice in quotes', () => {
    expect(describeExpression('mood >= "Good"', moodSchema)).toBe('Mood ≥ “Good”');
    expect(isYesNo('mood >= "Good"')).toBe(true);
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
    expect(describeExpression('duration / distance <= 9', runSchema)).toBe('Duration ÷ Distance ≤ 9');
    expect(describeExpression('distance == 3', runSchema)).toBe('Distance = 3');
    expect(describeExpression('(distance > 3) * 2', runSchema)).toBe('(Distance > 3) × 2');
    expect(describeExpression('distance != 3', runSchema)).toBe('Distance ≠ 3');
    expect(describeExpression('1 < distance < 5', runSchema)).toBe('1 < Distance < 5');
    expect(describeExpression('not treadmill and distance > 3 or duration < 10', runSchema)).toBe('not Treadmill and Distance > 3 or Duration < 10');
    expect(describeExpression('(treadmill or distance > 3) and duration < 10', runSchema)).toBe('(Treadmill or Distance > 3) and Duration < 10');
    expect(describeExpression('not (treadmill or distance > 3)', runSchema)).toBe('not (Treadmill or Distance > 3)');
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
