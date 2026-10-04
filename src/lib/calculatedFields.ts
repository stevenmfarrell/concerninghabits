import { z } from 'zod';
import type { HabitSchema } from './types';
import { fieldsOf, type FieldSchema } from './formFields';

// A value worked out from each entry's own fields, e.g. pace from `duration / distance`. Part of the
// habit's definition (stored as JSON in Habit.calculatedFields, owner only), and plotted like any
// number field. Its key is unique among the form's keys too, and never changes once made.
export const calculatedFieldSchema = z.object({
  key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).max(64),
  title: z.string().trim().min(1).max(100),
  // Form field keys, numbers, + - * / and parentheses (see parseExpression)
  expression: z.string().trim().min(1).max(500),
  unit: z.string().trim().max(40).optional(),
  // A duration is shown like the form's durations (h:mm:ss), from a value in minutes
  format: z.enum(['number', 'duration']).default('number'),
});

export type CalculatedField = z.infer<typeof calculatedFieldSchema>;

export const MAX_CALCULATED_FIELDS = 20;

export const calculatedFieldsSchema = z.array(calculatedFieldSchema).max(MAX_CALCULATED_FIELDS).superRefine((fields, ctx) => {
  const keys = new Set<string>();
  for (const field of fields) {
    if (keys.has(field.key)) ctx.addIssue({ code: 'custom', message: `Two calculated fields share the key "${field.key}"` });
    keys.add(field.key);
    const problem = expressionProblem(field.expression);
    if (problem) ctx.addIssue({ code: 'custom', message: `${field.title}: ${problem}` });
  }
});

// A habit's calculated fields as stored. Anything unreadable is dropped rather than breaking the page.
export function parseCalculatedFields(raw: string | null | undefined): CalculatedField[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap(item => {
      const result = calculatedFieldSchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

// --- Expressions ---

export type Expression =
  | { kind: 'number'; value: number }
  | { kind: 'field'; key: string }
  | { kind: 'negate'; operand: Expression }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: Expression; right: Expression };

type Token = { type: 'number'; value: number } | { type: 'name'; value: string } | { type: 'op'; value: string };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const match = /^(\d+\.?\d*|\.\d+)/.exec(source.slice(i));
      if (!match) throw new Error(`Unexpected "${c}"`);
      tokens.push({ type: 'number', value: Number(match[0]) });
      i += match[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i))![0];
      tokens.push({ type: 'name', value: name });
      i += name.length;
    } else if ('+-*/()'.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i++;
    } else {
      throw new Error(`"${c}" can't be used in a formula`);
    }
  }
  return tokens;
}

// Reads a formula into an expression tree, with the usual precedence (* and / before + and -).
// Throws an Error saying what's wrong with it.
export function parseExpression(source: string): Expression {
  const tokens = tokenize(source);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (value: string) => peek()?.type === 'op' && peek()!.value === value;

  function sum(): Expression {
    let left = product();
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++].value as '+' | '-';
      left = { kind: 'binary', op, left, right: product() };
    }
    return left;
  }
  function product(): Expression {
    let left = unary();
    while (isOp('*') || isOp('/')) {
      const op = tokens[pos++].value as '*' | '/';
      left = { kind: 'binary', op, left, right: unary() };
    }
    return left;
  }
  function unary(): Expression {
    if (isOp('-')) {
      pos++;
      return { kind: 'negate', operand: unary() };
    }
    if (isOp('+')) {
      pos++;
      return unary();
    }
    return primary();
  }
  function primary(): Expression {
    const token = tokens[pos++];
    if (!token) throw new Error('The formula ends too soon');
    if (token.type === 'number') return { kind: 'number', value: token.value };
    if (token.type === 'name') return { kind: 'field', key: token.value };
    if (token.value === '(') {
      const inner = sum();
      if (!isOp(')')) throw new Error('A "(" is missing its ")"');
      pos++;
      return inner;
    }
    throw new Error(`Unexpected "${token.value}"`);
  }

  if (tokens.length === 0) throw new Error('The formula is empty');
  const expression = sum();
  if (pos < tokens.length) throw new Error(`Unexpected "${tokens[pos].value}"`);
  return expression;
}

// What's wrong with a formula as written, or null if it reads
export function expressionProblem(source: string): string | null {
  try {
    parseExpression(source);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'The formula can\'t be read';
  }
}

// The field keys a formula uses, in the order they first appear
export function fieldsUsed(expression: Expression): string[] {
  const keys: string[] = [];
  const visit = (node: Expression) => {
    if (node.kind === 'field') {
      if (!keys.includes(node.key)) keys.push(node.key);
    } else if (node.kind === 'negate') visit(node.operand);
    else if (node.kind === 'binary') {
      visit(node.left);
      visit(node.right);
    }
  };
  visit(expression);
  return keys;
}

// A formula's value for an entry, or null when it has none: a field it uses is missing or not a
// number, or it divides by zero. A yes-or-no field counts as 1 or 0.
export function evaluate(expression: Expression, values: Record<string, unknown>): number | null {
  switch (expression.kind) {
    case 'number':
      return expression.value;
    case 'field': {
      const value = values[expression.key];
      if (typeof value === 'boolean') return value ? 1 : 0;
      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }
    case 'negate': {
      const value = evaluate(expression.operand, values);
      return value === null ? null : -value;
    }
    case 'binary': {
      const left = evaluate(expression.left, values);
      const right = evaluate(expression.right, values);
      if (left === null || right === null) return null;
      const result =
        expression.op === '+' ? left + right
        : expression.op === '-' ? left - right
        : expression.op === '*' ? left * right
        : left / right;
      return Number.isFinite(result) ? result : null;
    }
  }
}

// Calculated values are shown to two decimal places at most
function roundForDisplay(value: number) {
  return Math.round(value * 100) / 100;
}

// Whether a form field can go into a formula: a number, whole number, duration, or yes or no
export function isFormulaInput(field: FieldSchema | undefined) {
  return field?.type === 'number' || field?.type === 'integer' || field?.type === 'boolean';
}

// A formula's value for one entry, rounded for display, or null when it has none (including a
// formula that can't be read)
export function calculateValue(source: string, payload: Record<string, unknown>): number | null {
  try {
    const value = evaluate(parseExpression(source), payload);
    return value === null ? null : roundForDisplay(value);
  } catch {
    return null;
  }
}

// Why a calculated field can't work with the habit's form as it is, or null when it can: the
// formula doesn't read, or uses a field the form doesn't have (e.g. one since removed) or one
// that isn't a number or yes-or-no.
export function calculatedFieldProblem(field: Pick<CalculatedField, 'expression'>, schema: HabitSchema): string | null {
  let expression: Expression;
  try {
    expression = parseExpression(field.expression);
  } catch (e) {
    return e instanceof Error ? e.message : 'The formula can\'t be read';
  }
  const formFields = fieldsOf(schema);
  const used = fieldsUsed(expression);
  const missing = used.filter(key => !formFields[key]);
  if (missing.length > 0) return `Uses ${missing.map(k => `"${k}"`).join(', ')}, which the form doesn't have`;
  const notNumbers = used.filter(key => !isFormulaInput(formFields[key]));
  if (notNumbers.length > 0) return `Uses ${notNumbers.map(k => formFields[k].title || k).join(', ')}, which isn't a number`;
  return null;
}

const OPERATOR_SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷' } as const;
const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2 } as const;

// A formula for people, with fields by name, e.g. "Duration ÷ Distance". One that can't be read is
// shown as written.
export function describeExpression(source: string, schema: HabitSchema): string {
  let expression: Expression;
  try {
    expression = parseExpression(source);
  } catch {
    return source;
  }
  const formFields = fieldsOf(schema);
  const write = (node: Expression, parentPrecedence: number, rightSide: boolean): string => {
    switch (node.kind) {
      case 'number': return String(node.value);
      case 'field': return formFields[node.key]?.title || node.key;
      case 'negate': return `−${write(node.operand, 3, false)}`;
      case 'binary': {
        const precedence = PRECEDENCE[node.op];
        const text = `${write(node.left, precedence, false)} ${OPERATOR_SYMBOLS[node.op]} ${write(node.right, precedence, true)}`;
        // Brackets where the order would otherwise change, including a - (b - c) and a / (b / c)
        const needsBrackets = precedence < parentPrecedence || (rightSide && precedence === parentPrecedence);
        return needsBrackets ? `(${text})` : text;
      }
    }
  };
  return write(expression, 0, false);
}
