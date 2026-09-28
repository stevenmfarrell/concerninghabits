type CategoryLike = { id: string, name: string, parentId: string | null, order?: number | null };

const byOrder = (a: CategoryLike, b: CategoryLike) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name);

// Categories in display order: each top-level category (by saved order) followed by its subcategories.
// A category whose parent isn't in the list is treated as top-level.
export function orderCategoryTree<T extends CategoryLike>(categories: T[]) {
  const ids = new Set(categories.map(c => c.id));
  const topLevel = categories.filter(c => !c.parentId || !ids.has(c.parentId)).sort(byOrder);
  return topLevel.flatMap(parent => [
    { category: parent, depth: 0, parent: undefined as T | undefined },
    ...categories
      .filter(c => c.parentId === parent.id)
      .sort(byOrder)
      .map(category => ({ category, depth: 1, parent: parent as T | undefined })),
  ]);
}

// Labels for asking the AI to pick a category, mapped to their ids, in display order.
// Subcategories are written "Parent:Child" (e.g. "Fitness", "Fitness:Cardio"). Labels are unique;
// if two categories would share a label, the first one wins.
export function buildCategoryChoices(categories: CategoryLike[]) {
  const idsByLabel = new Map<string, string>();
  for (const { category, parent } of orderCategoryTree(categories)) {
    const label = parent ? `${parent.name}:${category.name}` : category.name;
    if (!idsByLabel.has(label)) idsByLabel.set(label, category.id);
  }
  return idsByLabel;
}
