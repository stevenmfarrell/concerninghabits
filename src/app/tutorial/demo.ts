import { skipLabels, type Cadence, type ProgressPeriod } from '@/lib/cadence';
import { CONSISTENCY_LABELS, type Consistency } from '@/lib/consistency';
import { formatLogValue } from '@/lib/format';
import type { FieldSchema } from '@/lib/formFields';
import { fieldTitle } from '@/components/widgets/habitForm';

// The tutorial's made-up habits, what's been done to them, and what that's called. None of it is
// saved: it lives in the tutorial's state until the step changes or starts over.

// What the demo rows need to place days the way the user's own rows do
export interface Days {
  timeZone: string;
  bedtime: string;
  weekStartsOn: string;
}

// A habit's form: its fields, as a habit's schema holds them
export interface DemoForm {
  required?: string[];
  properties: Record<string, FieldSchema>;
}

// A made-up habit, or with `habits`, a category with a cadence of its own
export interface DemoHabit {
  id: string;
  name: string;
  cadence: Cadence;
  // Entries it takes to be done for now, over `period`
  needed: number;
  period: ProgressPeriod | null;
  // Entries already counting toward done when the step starts
  startDone?: number;
  // How many days ago it was logged, for its calendars and entries, `perDay` times each day
  history: number[];
  perDay?: number;
  health: Consistency | null;
  // What it's filed under, for its page's category pill (a category's own icon for a category)
  filed: { name: string; icon: string };
  form?: DemoForm;
  // An earlier entry's values, for its page's Entries, by how many days ago it was
  pastValues?: (daysAgo: number) => Record<string, unknown>;
  // A category's habits, to pick from on logging it
  habits?: DemoHabit[];
}

// One entry made in the tutorial (or one it starts with): `picked` is the habit picked for a
// category, and `key` tells entries apart for an Undo
export interface DemoEntry {
  key: number;
  values?: Record<string, unknown>;
  picked?: string;
}

export interface RowState {
  entries: DemoEntry[];
  skipped: boolean;
}

export type Rows = Record<string, RowState>;

// How something was logged: a tap on its ring, holding its row, its page's Log Habit button, or
// the quill
export type How = 'ring' | 'hold' | 'page' | 'quill';

// Something done in a step, which the step checks against its goal
export type Action =
  | { kind: 'open'; habit: DemoHabit }
  | { kind: 'log'; habit: DemoHabit; how: How; picked?: string; values?: Record<string, unknown> }
  | { kind: 'skip'; habit: DemoHabit }
  | { kind: 'undo'; habit: DemoHabit; skip: boolean }
  // Closed a form or a category's picker without logging
  | { kind: 'cancel'; habit: DemoHabit }
  // Tapped the plant on its page, to see its health
  | { kind: 'plant'; habit: DemoHabit }
  // Told the quill something none of the step's habits goes with
  | { kind: 'unmatched'; input: string };

// What the tutorial says about an action: whether it reached the step's goal, got closer, or missed
export interface Verdict {
  tone: 'met' | 'progress' | 'miss';
  say: string;
}

export const isDone = (habit: DemoHabit, row: RowState) => row.entries.length >= habit.needed;
export const isDue = (habit: DemoHabit, row: RowState) => !row.skipped && !isDone(habit, row);

const PERIOD_WORDS: Record<ProgressPeriod, string> = { daily: 'today', weekly: 'this week', monthly: 'this month' };

// "2 of 3 this week", for one that takes several entries
export function progressOf(habit: DemoHabit, row: RowState) {
  return habit.period ? `${Math.min(row.entries.length, habit.needed)} of ${habit.needed} ${PERIOD_WORDS[habit.period]}` : null;
}

// A form's values in words, e.g. "Distance 3 miles, Time 30m"
export function valuesInWords(form: DemoForm | undefined, values: Record<string, unknown> | undefined) {
  return valueLines(form, values).join(', ');
}

export function valueLines(form: DemoForm | undefined, values: Record<string, unknown> | undefined) {
  return Object.entries(values ?? {})
    .filter(([, val]) => val !== undefined && val !== null && val !== '')
    .map(([key, val]) => `${fieldTitle(key, form?.properties)} ${formatLogValue(val, form?.properties[key])}`);
}

export function healthInWords(habit: DemoHabit) {
  const { health } = habit;
  if (!health) return `${habit.name} has no cadence, so its plant stays gray: nothing's expected of it`;
  const score = health.score === null ? 'too soon to say how consistent' : `${Math.round(health.score * 100)}% consistent lately`;
  const trend = health.trend === 'up' ? ', and improving' : health.trend === 'down' ? ', and slipping' : '';
  const level = health.level === 'needsCare' ? 'needs care' : `is ${CONSISTENCY_LABELS[health.level].toLowerCase()}`;
  return `${habit.name} ${level}: ${score}${trend}`;
}

// What an action did, as the app would have done it, for when it isn't what the step's after
export function describe(action: Action, rows: Rows): string {
  switch (action.kind) {
    case 'open':
      return `That opened ${action.habit.name}'s page: a tap on a row's name opens it.`;
    case 'log': {
      const { habit } = action;
      const row = rows[habit.id];
      const what = action.picked ?? habit.name;
      const values = action.values && Object.keys(action.values).length > 0 ? ` (${valuesInWords(habit.habits?.find(h => h.name === action.picked)?.form ?? habit.form, action.values)})` : '';
      const progress = progressOf(habit, row);
      const counts = action.picked ? `, which counts toward ${habit.name}` : '';
      if (isDone(habit, row)) return `Logged ${what}${values}${counts}${progress ? `: ${progress}` : ''}. That's done for now, so it left Due Now.`;
      return `Logged ${what}${values}${counts}${progress ? `: ${progress}` : ''}.`;
    }
    case 'skip': {
      const labels = skipLabels(action.habit.cadence);
      return labels?.postpones
        ? `That postponed ${action.habit.name}: it's due again a day later, and the wait doesn't count against it.`
        : `That skipped ${action.habit.name} for today. A skipped day doesn't count against it.`;
    }
    case 'undo':
      return action.skip ? `Undone: ${action.habit.name} is due again.` : `Undone: that entry's gone from ${action.habit.name}.`;
    case 'cancel':
      return 'Closed without logging. Nothing is logged until you tap Log Habit.';
    case 'plant':
      return `${healthInWords(action.habit)}.`;
    case 'unmatched':
      return /\b(want|start|begin|try)\b/i.test(action.input)
        ? `“${action.input}” sounds like a new habit. In the app, the quill drafts one for you to look over.`
        : `None of these habits goes with “${action.input}”. In the app, the quill would offer to make one.`;
  }
}

// The days ago over the last 100 a habit was done: every `every` days, missing about `missRate` of
// them (`recentMissRate` over the last 6 weeks), scattered the same way every time
function daysDone(every: number, missRate: number, recentMissRate = missRate) {
  const days: number[] = [];
  for (let d = 1; d <= 100; d += every) {
    const scatter = ((d * 7919) % 101) / 101;
    if (scatter >= (d <= 42 ? recentMissRate : missRate)) days.push(d);
  }
  return days;
}

const SCHEMA_RUN: DemoForm = {
  required: ['distance'],
  properties: {
    distance: { type: 'number', title: 'Distance', 'x-unit': 'miles' },
    time: { type: 'number', title: 'Time', 'x-widget': 'duration' },
    notes: { type: 'string', title: 'Notes', 'x-widget': 'textarea' },
  },
};

export const WATER: DemoHabit = {
  id: 'water',
  name: '💧 Water',
  cadence: { type: 'daily', timesPerDay: 8 },
  needed: 8,
  period: 'daily',
  startDone: 3,
  history: daysDone(1, 0.12),
  perDay: 8,
  health: { level: 'thriving', score: 0.91, trend: 'up' },
  filed: { name: 'Health', icon: 'HeartPulse' },
};

export const STRETCH: DemoHabit = {
  id: 'stretch',
  name: '🧘 Stretch',
  cadence: { type: 'daily', timesPerDay: 1 },
  needed: 1,
  period: null,
  history: daysDone(1, 0.55, 0.35),
  health: { level: 'takingRoot', score: 0.63, trend: null },
  filed: { name: 'Exercise', icon: 'PersonStanding' },
};

export const VITAMINS: DemoHabit = {
  id: 'vitamins',
  name: '💊 Vitamins',
  cadence: { type: 'daily', timesPerDay: 1 },
  needed: 1,
  period: null,
  history: daysDone(1, 0.1),
  health: { level: 'thriving', score: 0.88, trend: null },
  filed: { name: 'Health', icon: 'HeartPulse' },
};

export const RUN: DemoHabit = {
  id: 'run',
  name: '🏃 Run',
  cadence: { type: 'everyNDays', days: 3 },
  needed: 1,
  period: null,
  history: daysDone(3, 0.05),
  health: { level: 'thriving', score: 0.82, trend: 'up' },
  filed: { name: 'Exercise', icon: 'PersonStanding' },
  form: SCHEMA_RUN,
  pastValues: daysAgo => ({ distance: 2.5 + (Math.floor(daysAgo / 3) % 3) * 0.5, time: 24 + (daysAgo % 5) * 2 }),
};

export const READ: DemoHabit = {
  id: 'read',
  name: '📚 Read',
  cadence: { type: 'daily', timesPerDay: 1 },
  needed: 1,
  period: null,
  history: daysDone(1, 0.2, 0.65),
  health: { level: 'needsCare', score: 0.34, trend: 'down' },
  filed: { name: 'Learning', icon: 'GraduationCap' },
};

export const GUITAR: DemoHabit = {
  id: 'guitar',
  name: '🎸 Guitar',
  cadence: { type: 'calendarWeek', times: 2 },
  needed: 2,
  period: 'weekly',
  history: [2],
  health: { level: 'freshlyPlanted', score: null, trend: null },
  filed: { name: 'Learning', icon: 'GraduationCap' },
};

export const COOK: DemoHabit = {
  id: 'cook',
  name: '🍳 Cook',
  cadence: { type: 'none' },
  needed: 0,
  period: null,
  history: daysDone(5, 0.3),
  health: null,
  filed: { name: 'Home', icon: 'House' },
};

const SWIM: DemoHabit = { ...STRETCH, id: 'swim', name: '🏊 Swim', history: [5, 12, 20], filed: { name: 'Exercise', icon: 'PersonStanding' } };
const YOGA: DemoHabit = { ...STRETCH, id: 'yoga', name: '🧘 Yoga', history: [1, 8, 15], filed: { name: 'Exercise', icon: 'PersonStanding' } };

export const EXERCISE: DemoHabit = {
  id: 'exercise',
  name: 'Exercise',
  cadence: { type: 'calendarWeek', times: 3 },
  needed: 3,
  period: 'weekly',
  startDone: 1,
  history: daysDone(2, 0.1),
  health: { level: 'thriving', score: 0.86, trend: null },
  filed: { name: 'Exercise', icon: 'PersonStanding' },
  habits: [RUN, SWIM, YOGA],
};
