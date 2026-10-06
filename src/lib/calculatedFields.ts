import { z } from 'zod';
import type { HabitSchema } from './types';
import { fieldsOf, fieldTypeOf, type FieldSchema } from './formFields';

// A value worked out from each entry's own fields, e.g. pace from `duration / distance`. Part of the
// habit's definition (stored as JSON in Habit.calculatedFields, owner only), and plotted like any
// number field. Its key is unique among the form's keys too, and never changes once made.
export const calculatedFieldSchema = z.object({
  key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).max(64),
  title: z.string().trim().min(1).max(100),
  // Form field keys, numbers, + - * /, comparisons (== != <= >= < >), and, or, not, parentheses, and
  // text in quotes to compare a choice field with (see parseExpression and calculatedFieldProblem)
  expression: z.string().trim().min(1).max(500),
  unit: z.string().trim().max(40).optional(),
  // A duration is shown like the form's durations (h:mm:ss), from a value in minutes. A yes-or-no
  // field (see isYesNo) has no unit or format of its own; whatever's stored is ignored.
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
  // One of a choice field's choices, as written in quotes; only compared with that field
  | { kind: 'text'; value: string }
  | { kind: 'field'; key: string }
  | { kind: 'negate'; operand: Expression }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: Expression; right: Expression }
  | { kind: 'compare'; op: CompareOp; left: Expression; right: Expression }
  // Yes if both (and) or either (or) is. `chained` when it's a chain of comparisons, e.g. a < b < c
  // read as a < b and b < c, as Python does.
  | { kind: 'logic'; op: 'and' | 'or'; left: Expression; right: Expression; chained?: boolean }
  | { kind: 'not'; operand: Expression };

const COMPARE_OPS = ['==', '!=', '<=', '>=', '<', '>'] as const;
type CompareOp = (typeof COMPARE_OPS)[number];

// Words that are operators, as in Python, rather than field keys
const KEYWORDS = ['and', 'or', 'not'];

type Token = { type: 'number'; value: number } | { type: 'name'; value: string } | { type: 'text'; value: string } | { type: 'op'; value: string };

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
      tokens.push(KEYWORDS.includes(name) ? { type: 'op', value: name } : { type: 'name', value: name });
      i += name.length;
    } else if (c === '"' || c === "'") {
      const end = source.indexOf(c, i + 1);
      if (end < 0) throw new Error(`A ${c} is missing its closing ${c}`);
      tokens.push({ type: 'text', value: source.slice(i + 1, end) });
      i = end + 1;
    } else if ('+-*/()'.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i++;
    } else if ('<>=!'.includes(c)) {
      const op = COMPARE_OPS.find(o => source.startsWith(o, i));
      if (!op) throw new Error('Use == to check two values are equal');
      tokens.push({ type: 'op', value: op });
      i += op.length;
    } else {
      throw new Error(`"${c}" can't be used in a formula`);
    }
  }
  return tokens;
}

// Reads a formula into an expression tree, with Python's precedence: * and / before + and -, those
// before a comparison, then not, and, and last or. Throws an Error saying what's wrong with it.
export function parseExpression(source: string): Expression {
  const tokens = tokenize(source);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (value: string) => peek()?.type === 'op' && peek()!.value === value;
  const compareOp = () => COMPARE_OPS.find(isOp);

  function or(): Expression {
    let left = and();
    while (isOp('or')) {
      pos++;
      left = { kind: 'logic', op: 'or', left, right: and() };
    }
    return left;
  }
  function and(): Expression {
    let left = not();
    while (isOp('and')) {
      pos++;
      left = { kind: 'logic', op: 'and', left, right: not() };
    }
    return left;
  }
  function not(): Expression {
    if (isOp('not')) {
      pos++;
      return { kind: 'not', operand: not() };
    }
    return comparison();
  }
  // A chain, a < b < c, is a < b and b < c
  function comparison(): Expression {
    let left = sum();
    let expression: Expression | null = null;
    for (let op = compareOp(); op; op = compareOp()) {
      pos++;
      const right = sum();
      const compare: Expression = { kind: 'compare', op, left, right };
      expression = expression ? { kind: 'logic', op: 'and', left: expression, right: compare, chained: true } : compare;
      left = right;
    }
    return expression ?? left;
  }
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
    if (token.type === 'text') return { kind: 'text', value: token.value };
    if (token.value === '(') {
      const inner = or();
      if (!isOp(')')) throw new Error('A "(" is missing its ")"');
      pos++;
      return inner;
    }
    throw new Error(`Unexpected "${token.value}"`);
  }

  if (tokens.length === 0) throw new Error('The formula is empty');
  const expression = or();
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
    } else if (node.kind === 'negate' || node.kind === 'not') visit(node.operand);
    else if (node.kind === 'binary' || node.kind === 'compare' || node.kind === 'logic') {
      visit(node.left);
      visit(node.right);
    }
  };
  visit(expression);
  return keys;
}

// The form's choice fields' choices, in order, by field key, for comparing choices (see evaluate)
export type ChoiceLists = Record<string, string[]>;

export function choiceLists(schema: HabitSchema): ChoiceLists {
  return Object.fromEntries(Object.entries(fieldsOf(schema)).filter(([, field]) => isChoiceField(field)).map(([key, field]) => [key, field.enum!.map(String)]));
}

// Where a choice is in its field's list, or null when it isn't in it
function choiceIndex(choices: string[] | undefined, value: unknown) {
  const index = choices && typeof value === 'string' ? choices.indexOf(value) : -1;
  return index < 0 ? null : index;
}

// A formula's value for an entry, or null when it has none: a field it uses is missing or not a
// number, or it divides by zero. A yes-or-no field, and a comparison, counts as 1 or 0, and and, or
// and not give 1 or 0, taking anything but 0 as yes. A missing value only makes and, or or not have
// none when it matters: no and anything is no, and yes or anything is yes. A choice
// field is compared with one of its choices by their places in its list (from `choices`), so
// mood >= "Good" is Good or any choice after it.
export function evaluate(expression: Expression, values: Record<string, unknown>, choices: ChoiceLists = {}): number | null {
  switch (expression.kind) {
    case 'number':
      return expression.value;
    case 'text':
      // Only has a value as the other side of a comparison with a choice field
      return null;
    case 'field': {
      const value = values[expression.key];
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (choices[expression.key]) return choiceIndex(choices[expression.key], value);
      return typeof value === 'number' && Number.isFinite(value) ? value : null;
    }
    case 'negate': {
      const value = evaluate(expression.operand, values, choices);
      return value === null ? null : -value;
    }
    case 'binary': {
      const left = evaluate(expression.left, values, choices);
      const right = evaluate(expression.right, values, choices);
      if (left === null || right === null) return null;
      const result =
        expression.op === '+' ? left + right
        : expression.op === '-' ? left - right
        : expression.op === '*' ? left * right
        : left / right;
      return Number.isFinite(result) ? result : null;
    }
    case 'compare': {
      // Text is the place of that choice in the list of the field it's compared with
      const side = (node: Expression, other: Expression) =>
        node.kind === 'text' ? (other.kind === 'field' ? choiceIndex(choices[other.key], node.value) : null) : evaluate(node, values, choices);
      const left = side(expression.left, expression.right);
      const right = side(expression.right, expression.left);
      if (left === null || right === null) return null;
      // Equal within rounding, so e.g. 0.1 + 0.2 == 0.3
      const equal = Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
      const result =
        expression.op === '==' ? equal
        : expression.op === '!=' ? !equal
        : expression.op === '<=' ? left < right || equal
        : expression.op === '>=' ? left > right || equal
        : expression.op === '<' ? left < right && !equal
        : left > right && !equal;
      return result ? 1 : 0;
    }
    case 'not': {
      const value = evaluate(expression.operand, values, choices);
      return value === null ? null : value === 0 ? 1 : 0;
    }
    case 'logic': {
      const truth = (node: Expression) => {
        const value = evaluate(node, values, choices);
        return value === null ? null : value !== 0;
      };
      const left = truth(expression.left);
      const right = truth(expression.right);
      // The side that settles it, whatever the other is
      const settles = expression.op === 'and' ? false : true;
      if (left === settles || right === settles) return settles ? 1 : 0;
      if (left === null || right === null) return null;
      return settles ? 0 : 1;
    }
  }
}

// Whether a formula gives yes or no (1 or 0) rather than a number: it's a comparison, e.g.
// "distance >= 3", or and, or or not. One that can't be read isn't.
export function isYesNo(source: string) {
  try {
    const kind = parseExpression(source).kind;
    return kind === 'compare' || kind === 'logic' || kind === 'not';
  } catch {
    return false;
  }
}

// Calculated values are shown to two decimal places at most
function roundForDisplay(value: number) {
  return Math.round(value * 100) / 100;
}

function isChoiceField(field: FieldSchema | undefined) {
  return !!field && fieldTypeOf(field) === 'choice' && field.enum!.length > 0;
}

// Whether a form field can go into a formula: a number, whole number, duration, or yes or no, or a
// choice (one of a list), which can only be compared with one of its choices
export function isFormulaInput(field: FieldSchema | undefined) {
  return field?.type === 'number' || field?.type === 'integer' || field?.type === 'boolean' || isChoiceField(field);
}

// A formula's value for one entry, rounded for display, or null when it has none (including a
// formula that can't be read). `choices` are the form's (see choiceLists).
export function calculateValue(source: string, payload: Record<string, unknown>, choices: ChoiceLists = {}): number | null {
  try {
    const value = evaluate(parseExpression(source), payload, choices);
    return value === null ? null : roundForDisplay(value);
  } catch {
    return null;
  }
}

// Why a calculated field can't work with the habit's form as it is, or null when it can: the
// formula doesn't read, or uses a field the form doesn't have (e.g. one since removed) or one that
// isn't a number, yes-or-no or choice, or compares a choice field with anything but one of its
// choices (or uses text in quotes anywhere else).
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
  return choiceProblem(expression, schema);
}

// A choice field, or text, used other than as `field <comparison> "one of its choices"`
function choiceProblem(expression: Expression, schema: HabitSchema): string | null {
  const formFields = fieldsOf(schema);
  const lists = choiceLists(schema);
  const misused = (node: Expression): string | null => {
    if (node.kind === 'text') return `Text in quotes, like "${node.value}", can only be compared with a choice field, e.g. mood == "Good"`;
    if (node.kind === 'field' && lists[node.key]) {
      const title = formFields[node.key].title || node.key;
      return `${title} is one of a list, so it can only be compared with one of its choices, e.g. ${node.key} == "${lists[node.key][0]}"`;
    }
    return null;
  };
  const visit = (node: Expression): string | null => {
    if (node.kind === 'compare') {
      const [field, text] = node.left.kind === 'text' ? [node.right, node.left] : [node.left, node.right];
      if (field.kind === 'field' && lists[field.key] && text.kind === 'text') {
        const choices = lists[field.key];
        if (choices.includes(text.value)) return null;
        return `"${text.value}" isn't one of ${formFields[field.key].title || field.key}'s choices (${choices.join(', ')})`;
      }
      return visit(node.left) ?? visit(node.right);
    }
    if (node.kind === 'negate' || node.kind === 'not') return visit(node.operand);
    if (node.kind === 'binary' || node.kind === 'logic') return visit(node.left) ?? visit(node.right);
    return misused(node);
  };
  return visit(expression);
}

const OPERATOR_SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷', '==': '=', '!=': '≠', '<=': '≤', '>=': '≥', '<': '<', '>': '>', and: 'and', or: 'or' } as const;
const PRECEDENCE = { or: -3, and: -2, not: -1, '==': 0, '!=': 0, '<=': 0, '>=': 0, '<': 0, '>': 0, '+': 1, '-': 1, '*': 2, '/': 2 } as const;

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
      case 'text': return `“${node.value}”`;
      case 'field': return formFields[node.key]?.title || node.key;
      case 'negate': return `−${write(node.operand, 3, false)}`;
      case 'not': {
        const text = `not ${write(node.operand, PRECEDENCE.not, false)}`;
        return PRECEDENCE.not < parentPrecedence ? `(${text})` : text;
      }
      case 'logic':
        // A chain is written as one, a < b < c, rather than as the two comparisons it means
        if (node.chained && node.right.kind === 'compare') {
          const text = `${write(node.left, 0, false)} ${OPERATOR_SYMBOLS[node.right.op]} ${write(node.right.right, 0, true)}`;
          return 0 < parentPrecedence || (0 === parentPrecedence && rightSide) ? `(${text})` : text;
        }
      // falls through
      case 'binary':
      case 'compare': {
        const precedence = PRECEDENCE[node.op];
        const text = `${write(node.left, precedence, false)} ${OPERATOR_SYMBOLS[node.op]} ${write(node.right, precedence, true)}`;
        // Brackets where the order would otherwise change, including a - (b - c) and a / (b / c)
        const needsBrackets = precedence < parentPrecedence || (rightSide && precedence === parentPrecedence);
        return needsBrackets ? `(${text})` : text;
      }
    }
  };
  return write(expression, -4, false);
}
