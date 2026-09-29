import { arrayMove } from '@dnd-kit/sortable';

// Drag-and-drop rules for the Manage Categories list (two levels: top-level categories and subcategories).
// computeDrop runs on every drag move to drive the preview and again on drop, so the preview
// always matches what gets saved.

type Category = { id: string, parentId?: string | null, order?: number | null };
type Rect = { top: number, height: number };

// Horizontal drag distance (px) that switches from reordering to nesting / un-nesting
export const NEST_THRESHOLD = 30;

export type DropResult = {
  mode: 'reorder' | 'nest' | 'move';
  parentId: string | null;
  anchorId?: string;                 // row to place before/after (or swap with, for 'reorder')
  position?: 'before' | 'after';
  placement?: 'first' | 'last';      // used when there's no anchor
};

export const sameDropResult = (a: DropResult | null, b: DropResult | null) =>
  a === b || (!!a && !!b && a.mode === b.mode && a.parentId === b.parentId && a.anchorId === b.anchorId && a.position === b.position && a.placement === b.placement);

const byOrder = (a: Category, b: Category) => (a.order ?? 0) - (b.order ?? 0);

export const siblingsOf = <T extends Category>(list: T[], parentId: string | null) =>
  list.filter(c => (c.parentId ?? null) === parentId).sort(byOrder);

// Rows that aren't sliding out of the way get a before/after placement based on
// which half of the row the dragged item is over.
export const getDropPosition = (dragged: Rect | null | undefined, over: Rect | null | undefined): 'before' | 'after' => {
  if (!dragged || !over) return 'before';
  return dragged.top + dragged.height / 2 > over.top + over.height / 2 ? 'after' : 'before';
};

export function computeDrop(
  categories: Category[],
  sourceId: string,
  targetId: string | null,
  deltaX: number,
  position: 'before' | 'after',
): DropResult | null {
  const source = categories.find(c => c.id === sourceId);
  const target = targetId ? categories.find(c => c.id === targetId) : null;
  if (!source || !target) return null;

  const sourceParentId = source.parentId ?? null;
  const targetParentId = target.parentId ?? null;
  // Mirrors the server's "a category with subcategories can't be nested" rule
  // (assertValidParent in src/app/actions/db.ts) — keep in sync with it.
  const sourceHasChildren = categories.some(c => c.parentId === source.id);

  // Drag right: nest into the row being hovered (or, over itself, into the category above).
  // `newParentId` is always `targetParentId ?? target.id` — i.e. always a top-level id — which is
  // what keeps this in sync with the server's "a parent must be top-level" rule (assertValidParent
  // in src/app/actions/db.ts) without checking it explicitly here.
  if (deltaX > NEST_THRESHOLD && !sourceHasChildren) {
    if (target.id === source.id) {
      if (!sourceParentId) {
        const topLevels = siblingsOf(categories, null);
        const idx = topLevels.findIndex(c => c.id === source.id);
        if (idx > 0) return { mode: 'nest', parentId: topLevels[idx - 1].id, placement: 'last' };
      }
    } else {
      const newParentId = targetParentId ?? target.id;
      if (newParentId !== sourceParentId) {
        return targetParentId
          ? { mode: 'nest', parentId: newParentId, anchorId: target.id, position }
          : { mode: 'nest', parentId: newParentId, placement: 'first' };
      }
    }
  }

  // Drag left: un-nest to top level, next to the hovered top-level row or right after the parent group
  if (deltaX < -NEST_THRESHOLD && sourceParentId) {
    if (!targetParentId) return { mode: 'move', parentId: null, anchorId: target.id, position };
    return { mode: 'move', parentId: null, anchorId: targetParentId, position: 'after' };
  }

  if (target.id === source.id) return null;

  // Same list: a normal sortable reorder
  if (targetParentId === sourceParentId) {
    return { mode: 'reorder', parentId: sourceParentId, anchorId: target.id };
  }

  // A top-level category can only move among top-level rows vertically
  if (!sourceParentId) return null;

  // Subcategory dropped on another parent's subcategory, or on a top-level row (becomes top-level)
  return { mode: 'move', parentId: targetParentId, anchorId: target.id, position };
}

// Apply a drop to the category list, renumbering order so parents and their children stay grouped
export function applyDrop<T extends Category>(categories: T[], sourceId: string, drop: DropResult): T[] {
  const source = categories.find(c => c.id === sourceId);
  if (!source) return categories;
  const moved = { ...source, parentId: drop.parentId };
  const others = categories.filter(c => c.id !== sourceId);

  let siblings: T[];
  if (drop.mode === 'reorder') {
    const current = siblingsOf(categories, drop.parentId);
    siblings = arrayMove(current, current.findIndex(c => c.id === sourceId), current.findIndex(c => c.id === drop.anchorId));
  } else {
    siblings = siblingsOf(others, drop.parentId);
    let insertIndex = drop.placement === 'first' ? 0 : siblings.length;
    if (drop.anchorId) {
      const anchorIndex = siblings.findIndex(c => c.id === drop.anchorId);
      if (anchorIndex !== -1) insertIndex = drop.position === 'after' ? anchorIndex + 1 : anchorIndex;
    }
    siblings.splice(insertIndex, 0, moved);
  }

  const ordered: T[] = [];
  const topLevels = drop.parentId === null ? siblings : siblingsOf(others, null);
  for (const top of topLevels) {
    ordered.push(top);
    ordered.push(...(top.id === drop.parentId ? siblings : siblingsOf(others, top.id)));
  }
  return ordered.map((c, index) => ({ ...(c.id === sourceId ? moved : c), order: index }));
}
