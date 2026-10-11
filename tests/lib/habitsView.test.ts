import { describe, expect, it } from 'vitest';
import { alphabeticalKey, parseHabitsDir, parseHabitsSort, parseHabitsView, sortRows, type SortableRow } from '@/lib/habitsView';
import type { Consistency } from '@/lib/consistency';

const health = (level: Consistency['level'], score: number | null = 0.5): Consistency => ({ level, score, trend: null });

function row(name: string, index: number, extra: Partial<SortableRow> = {}): SortableRow & { id: string } {
  return { id: name, name, index, lastDone: null, consistency: null, ...extra };
}

const ids = (rows: { id: string }[]) => rows.map(r => r.id);

describe('sortRows', () => {
  it('keeps the user\'s own order, or reverses it', () => {
    expect(ids(sortRows([row('b', 0), row('a', 1)], 'custom'))).toEqual(['b', 'a']);
    expect(ids(sortRows([row('b', 0), row('a', 1), row('c', 2)], 'custom', 'desc'))).toEqual(['c', 'a', 'b']);
  });

  it('sorts by name, ignoring case and reading numbers as numbers', () => {
    expect(ids(sortRows([row('run 10k', 0), row('Bike', 1), row('run 5k', 2), row('apple', 3)], 'name')))
      .toEqual(['apple', 'Bike', 'run 5k', 'run 10k']);
  });

  it('puts the most recently done first, and never done last in the user\'s order', () => {
    const rows = [
      row('never1', 0),
      row('old', 1, { lastDone: new Date('2026-01-01') }),
      row('never2', 2),
      row('new', 3, { lastDone: new Date('2026-10-01') }),
    ];
    expect(ids(sortRows(rows, 'lastDone'))).toEqual(['new', 'old', 'never1', 'never2']);
    expect(ids(sortRows(rows, 'lastDone', 'asc'))).toEqual(['old', 'new', 'never1', 'never2']);
  });

  it('sorts by name ignoring emoji and whitespace', () => {
    const rows = [row('🏃 Running', 0), row('  apple', 1), row('🏋️‍♀️Bench', 2), row('🇺🇸 Citizenship', 3), row('Dishes 🍽️', 4)];
    expect(ids(sortRows(rows, 'name'))).toEqual(['  apple', '🏋️‍♀️Bench', '🇺🇸 Citizenship', 'Dishes 🍽️', '🏃 Running']);
  });

  it('keeps digits and symbols in a name\'s sort key, and a name that\'s all emoji as it is', () => {
    expect(alphabeticalKey('🔢 10k #2')).toBe('10k#2');
    expect(alphabeticalKey('🎸')).toBe('🎸');
  });

  it('sorts by name either way', () => {
    expect(ids(sortRows([row('b', 0), row('a', 1), row('c', 2)], 'name', 'desc'))).toEqual(['c', 'b', 'a']);
  });

  it('puts what needs care first, worst score first, then freshly planted and no cadence', () => {
    const rows = [
      row('none', 0),
      row('thriving', 1, { consistency: health('thriving', 0.9) }),
      row('fresh', 2, { consistency: health('freshlyPlanted', null) }),
      row('care-ok', 3, { consistency: health('needsCare', 0.4) }),
      row('rooting', 4, { consistency: health('takingRoot', 0.6) }),
      row('care-bad', 5, { consistency: health('needsCare', 0.1) }),
    ];
    expect(ids(sortRows(rows, 'health'))).toEqual(['care-bad', 'care-ok', 'rooting', 'thriving', 'fresh', 'none']);
    // Thriving first, with what has no health yet still last
    expect(ids(sortRows(rows, 'health', 'desc'))).toEqual(['thriving', 'rooting', 'care-ok', 'care-bad', 'fresh', 'none']);
  });
});

describe('parsing the saved choice', () => {
  it('falls back to categories in your order for anything unknown', () => {
    expect(parseHabitsView('habits')).toBe('habits');
    expect(parseHabitsView('bogus')).toBe('categories');
    expect(parseHabitsView(undefined)).toBe('categories');
    expect(parseHabitsSort('health')).toBe('health');
    expect(parseHabitsSort('bogus')).toBe('custom');
    expect(parseHabitsDir('desc', 'name')).toBe('desc');
    expect(parseHabitsDir(undefined, 'lastDone')).toBe('desc');
    expect(parseHabitsDir('bogus', 'health')).toBe('asc');
  });
});
