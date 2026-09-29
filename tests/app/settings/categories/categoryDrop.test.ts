import { describe, expect, it } from 'vitest';
import { NEST_THRESHOLD, applyDrop, computeDrop, getDropPosition, sameDropResult } from '@/app/settings/categories/categoryDrop';

type Cat = { id: string; parentId?: string | null; order?: number | null };

// Two top-level categories (a, b) plus a third (c) that has two subcategories (c1, c2).
const categories: Cat[] = [
  { id: 'a', parentId: null, order: 0 },
  { id: 'b', parentId: null, order: 1 },
  { id: 'c', parentId: null, order: 2 },
  { id: 'c1', parentId: 'c', order: 0 },
  { id: 'c2', parentId: 'c', order: 1 },
];

describe('computeDrop: reordering (no horizontal drag)', () => {
  it('reorders two top-level siblings', () => {
    expect(computeDrop(categories, 'a', 'b', 0, 'after')).toEqual({
      mode: 'reorder', parentId: null, anchorId: 'b',
    });
  });

  it('reorders two subcategories under the same parent', () => {
    expect(computeDrop(categories, 'c1', 'c2', 0, 'after')).toEqual({
      mode: 'reorder', parentId: 'c', anchorId: 'c2',
    });
  });

  it('returns null when dropped on itself', () => {
    expect(computeDrop(categories, 'a', 'a', 0, 'after')).toBeNull();
  });

  it('returns null for a top-level category dropped onto another parent\'s subcategory', () => {
    // Top-level rows can only move vertically among other top-level rows.
    expect(computeDrop(categories, 'a', 'c1', 0, 'after')).toBeNull();
  });

  it('moves a subcategory onto a different parent\'s subcategory', () => {
    const others: Cat[] = [...categories, { id: 'b1', parentId: 'b', order: 0 }];
    expect(computeDrop(others, 'c1', 'b1', 0, 'after')).toEqual({
      mode: 'move', parentId: 'b', anchorId: 'b1', position: 'after',
    });
  });
});

// The audit flagged NEST_THRESHOLD as a single magic constant gating three different drag
// behaviors with no test coverage — these pin down the exact boundary so a future change to the
// constant (or an accidental off-by-one in the comparison) gets caught here first.
describe('computeDrop: NEST_THRESHOLD boundary (drag right to nest)', () => {
  it('does not nest exactly at the threshold', () => {
    const result = computeDrop(categories, 'a', 'b', NEST_THRESHOLD, 'after');
    expect(result?.mode).not.toBe('nest');
  });

  it('nests just past the threshold', () => {
    expect(computeDrop(categories, 'a', 'b', NEST_THRESHOLD + 1, 'after')).toEqual({
      mode: 'nest', parentId: 'b', placement: 'first',
    });
  });

  it('never nests a category that already has subcategories', () => {
    // Mirrors the server's "a category with subcategories can't be nested" rule
    // (assertValidParent in src/app/actions/db.ts) — see the comment on sourceHasChildren below.
    const result = computeDrop(categories, 'c', 'b', NEST_THRESHOLD + 1, 'after');
    expect(result?.mode).not.toBe('nest');
  });

  it('nests onto a subcategory\'s parent, not the subcategory itself', () => {
    // Dragging onto c1 (child of c) should nest under c, never two levels deep under c1.
    expect(computeDrop(categories, 'a', 'c1', NEST_THRESHOLD + 1, 'after')).toEqual({
      mode: 'nest', parentId: 'c', anchorId: 'c1', position: 'after',
    });
  });

  it('dragged onto itself, nests into the sibling above', () => {
    expect(computeDrop(categories, 'b', 'b', NEST_THRESHOLD + 1, 'after')).toEqual({
      mode: 'nest', parentId: 'a', placement: 'last',
    });
  });
});

describe('computeDrop: NEST_THRESHOLD boundary (drag left to un-nest)', () => {
  // Dropping c1 onto b1 (a subcategory of a different parent, b) distinguishes the two branches:
  // below threshold it's a same-level move under b1's parent; past it, c1 escapes to top level.
  it('does not un-nest exactly at the threshold (stays nested, moves under the target\'s parent)', () => {
    const others: Cat[] = [...categories, { id: 'b1', parentId: 'b', order: 0 }];
    expect(computeDrop(others, 'c1', 'b1', -NEST_THRESHOLD, 'after')).toEqual({
      mode: 'move', parentId: 'b', anchorId: 'b1', position: 'after',
    });
  });

  it('un-nests just past the threshold, landing after the target\'s parent group', () => {
    const others: Cat[] = [...categories, { id: 'b1', parentId: 'b', order: 0 }];
    expect(computeDrop(others, 'c1', 'b1', -NEST_THRESHOLD - 1, 'after')).toEqual({
      mode: 'move', parentId: null, anchorId: 'b', position: 'after',
    });
  });

  it('un-nests onto a top-level row, landing next to it', () => {
    expect(computeDrop(categories, 'c1', 'a', -NEST_THRESHOLD - 1, 'after')).toEqual({
      mode: 'move', parentId: null, anchorId: 'a', position: 'after',
    });
  });

  it('a top-level category is never un-nested (no parentId to remove)', () => {
    const result = computeDrop(categories, 'a', 'b', -NEST_THRESHOLD - 1, 'after');
    expect(result).not.toEqual(expect.objectContaining({ mode: 'move' }));
  });
});

describe('getDropPosition', () => {
  it('defaults to "before" when either rect is missing', () => {
    expect(getDropPosition(null, { top: 0, height: 10 })).toBe('before');
    expect(getDropPosition({ top: 0, height: 10 }, undefined)).toBe('before');
  });

  it('is "after" when the dragged row\'s center is below the target\'s center', () => {
    expect(getDropPosition({ top: 20, height: 10 }, { top: 0, height: 10 })).toBe('after');
  });

  it('is "before" when the dragged row\'s center is above the target\'s center', () => {
    expect(getDropPosition({ top: 0, height: 10 }, { top: 20, height: 10 })).toBe('before');
  });
});

describe('sameDropResult', () => {
  it('treats null and null as equal', () => {
    expect(sameDropResult(null, null)).toBe(true);
  });

  it('treats field-for-field identical results as equal', () => {
    const a = { mode: 'reorder' as const, parentId: null, anchorId: 'b' };
    const b = { mode: 'reorder' as const, parentId: null, anchorId: 'b' };
    expect(sameDropResult(a, b)).toBe(true);
  });

  it('treats a null and a non-null result as different', () => {
    expect(sameDropResult(null, { mode: 'reorder', parentId: null, anchorId: 'b' })).toBe(false);
  });

  it('treats results with a different anchor as different', () => {
    const a = { mode: 'reorder' as const, parentId: null, anchorId: 'b' };
    const b = { mode: 'reorder' as const, parentId: null, anchorId: 'c' };
    expect(sameDropResult(a, b)).toBe(false);
  });
});

describe('applyDrop', () => {
  it('reorders a top-level category to the end of its siblings', () => {
    const result = applyDrop(categories, 'a', { mode: 'reorder', parentId: null, anchorId: 'c' });
    const topLevelIds = result.filter(c => !c.parentId).sort((x, y) => (x.order ?? 0) - (y.order ?? 0)).map(c => c.id);
    expect(topLevelIds).toEqual(['b', 'c', 'a']);
  });

  it('nests a top-level category under another, as its only child', () => {
    const result = applyDrop(categories, 'a', { mode: 'nest', parentId: 'b', placement: 'first' });
    const moved = result.find(c => c.id === 'a');
    expect(moved?.parentId).toBe('b');

    const topLevelIds = result.filter(c => !c.parentId).map(c => c.id);
    expect(topLevelIds.sort()).toEqual(['b', 'c']);
  });

  it('un-nests a subcategory back to top level', () => {
    const result = applyDrop(categories, 'c1', { mode: 'move', parentId: null, anchorId: 'a', position: 'after' });
    const moved = result.find(c => c.id === 'c1');
    expect(moved?.parentId).toBeNull();

    // c's remaining child (c2) should be unaffected.
    expect(result.find(c => c.id === 'c2')?.parentId).toBe('c');
  });

  it('keeps a parent\'s children grouped immediately after it in the flattened result', () => {
    const result = applyDrop(categories, 'a', { mode: 'reorder', parentId: null, anchorId: 'c' });
    const ids = result.map(c => c.id);
    const cIndex = ids.indexOf('c');
    const c1Index = ids.indexOf('c1');
    const c2Index = ids.indexOf('c2');
    expect(c1Index).toBeGreaterThan(cIndex);
    expect(c2Index).toBeGreaterThan(c1Index);
  });

  it('is a no-op when the source category no longer exists', () => {
    const result = applyDrop(categories, 'missing', { mode: 'reorder', parentId: null, anchorId: 'b' });
    expect(result).toBe(categories);
  });
});
