import type { Consistency, ConsistencyLevel } from './consistency';

// How the Habits page lists things: by category (each a row opening its page), or every habit in
// one list. Kept in a cookie (and the URL while choosing), like a habit page's time range.
export const HABITS_VIEWS = ['categories', 'habits'] as const;
export type HabitsView = (typeof HABITS_VIEWS)[number];

// The order they're in: the user's own (as arranged on Manage Categories and each category's
// page), by health, by when last done, or by name, each either way (`HabitsDir`), the user's own
// order reversed included
export const HABITS_SORTS = ['custom', 'health', 'lastDone', 'name'] as const;
export type HabitsSort = (typeof HABITS_SORTS)[number];

export const HABITS_SORT_LABELS: Record<HabitsSort, string> = {
  custom: 'Your order',
  health: 'Habit health',
  lastDone: 'Last logged',
  name: 'Alphabetical',
};

// Ascending is the user's own order as arranged, worst health first, longest ago first, or A to Z
export const HABITS_DIRS = ['asc', 'desc'] as const;
export type HabitsDir = (typeof HABITS_DIRS)[number];

// Which way each sort goes until the user flips it: what needs care, what was done most recently,
// and A to Z first
const DEFAULT_DIRS: Record<HabitsSort, HabitsDir> = { custom: 'asc', health: 'asc', lastDone: 'desc', name: 'asc' };

export function defaultHabitsDir(sort: HabitsSort) {
  return DEFAULT_DIRS[sort];
}

// What each direction puts first, e.g. for the button that flips it
export const HABITS_DIR_LABELS: Record<HabitsSort, Record<HabitsDir, string>> = {
  custom: { asc: 'As arranged', desc: 'Reversed' },
  health: { asc: 'Needs care first', desc: 'Thriving first' },
  lastDone: { asc: 'Longest ago first', desc: 'Most recent first' },
  name: { asc: 'A to Z', desc: 'Z to A' },
};

export const HABITS_VIEW_COOKIE = 'habits_view';
export const HABITS_SORT_COOKIE = 'habits_sort';
export const HABITS_DIR_COOKIE = 'habits_dir';

export function parseHabitsView(value: string | undefined): HabitsView {
  return HABITS_VIEWS.includes(value as HabitsView) ? value as HabitsView : 'categories';
}

export function parseHabitsSort(value: string | undefined): HabitsSort {
  return HABITS_SORTS.includes(value as HabitsSort) ? value as HabitsSort : 'custom';
}

export function parseHabitsDir(value: string | undefined, sort: HabitsSort): HabitsDir {
  return HABITS_DIRS.includes(value as HabitsDir) ? value as HabitsDir : defaultHabitsDir(sort);
}

// What a row is sorted on. `index` is its place in the user's own order.
export interface SortableRow {
  index: number;
  name: string;
  lastDone: Date | null;
  consistency: Consistency | null | undefined;
}

const HEALTH_RANK: Record<ConsistencyLevel, number> = { needsCare: 0, takingRoot: 1, thriving: 2, freshlyPlanted: 3 };

// What a row is sorted by, lowest first, or null when there's nothing to sort it by (no health yet,
// or never done). Those go last whichever way it's sorted, freshly planted ahead of no cadence.
function sortKey(row: SortableRow, sort: Exclude<HabitsSort, 'custom' | 'name'>): number[] | null {
  if (sort === 'lastDone') return row.lastDone ? [row.lastDone.getTime()] : null;
  if (!row.consistency || row.consistency.level === 'freshlyPlanted') return null;
  return [HEALTH_RANK[row.consistency.level], row.consistency.score ?? 0];
}

function unrankedOrder(row: SortableRow, sort: HabitsSort) {
  return sort === 'health' && row.consistency?.level === 'freshlyPlanted' ? 0 : 1;
}

function compareKeys(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

// Emoji (and the joiners, skin tones and selectors they're built from) and whitespace, which a name
// is sorted without, so "🏃 Running" sorts under R. Not \p{Emoji}, which takes in digits and #.
const UNSORTED_CHARS = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u{200D}\u{FE0E}\u{FE0F}\u{20E3}\s]/gu;

// What a name is sorted by: itself without emoji or whitespace, or as it is if that's all it is
export function alphabeticalKey(name: string) {
  return name.replace(UNSORTED_CHARS, '') || name;
}

// `rows` in `sort`'s order, going `dir`, ties kept in the user's own order
export function sortRows<T extends SortableRow>(rows: T[], sort: HabitsSort, dir: HabitsDir = defaultHabitsDir(sort)): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  const compare = (a: T, b: T): number => {
    if (sort === 'custom') return sign * (a.index - b.index);
    if (sort === 'name') return sign * alphabeticalKey(a.name).localeCompare(alphabeticalKey(b.name), undefined, { sensitivity: 'base', numeric: true });
    const keyA = sortKey(a, sort);
    const keyB = sortKey(b, sort);
    if (keyA && keyB) return sign * compareKeys(keyA, keyB);
    if (keyA || keyB) return keyA ? -1 : 1;
    return unrankedOrder(a, sort) - unrankedOrder(b, sort);
  };
  return [...rows].sort((a, b) => compare(a, b) || a.index - b.index);
}
