'use client';

import { useState } from 'react';
import { createCategory } from '@/app/actions/categories';
import CategorySelect from './CategorySelect';
import NewCategoryInline from './NewCategoryInline';
import QuickEditDialog from './QuickEditDialog';
import Icon from './Icon';
import { PILL } from './CadenceQuickEdit';
import { DEFAULT_CATEGORY_ICON, UNCATEGORIZED_ICON } from '@/lib/constants';
import type { CategoryOption } from '@/lib/types';

// A habit's category as a pill (e.g. "Fitness › Cardio") that opens a dialog to change it, or to
// make a new one there. `onCreated` hears about a category made in the dialog, so the caller's list
// (and this pill) can show it. `saveLabel` names the dialog's button (see QuickEditDialog).
export default function CategoryQuickEdit({ categoryId, categories, onSave, onCreated, saveLabel }: {
  categoryId: string | null;
  categories: CategoryOption[];
  onSave: (categoryId: string | null) => Promise<void>;
  onCreated?: (category: CategoryOption) => void;
  saveLabel?: string;
}) {
  const [editing, setEditing] = useState(false);

  const category = categories.find(c => c.id === categoryId);
  const parent = category?.parentId ? categories.find(c => c.id === category.parentId) : undefined;
  // A category that isn't in the list yet (still loading) is shown as just "Category"
  const label = category ? (parent ? `${parent.name} › ${category.name}` : category.name) : categoryId ? 'Category' : 'Uncategorized';

  return (
    <>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`${PILL} bg-category-soft border-category-line text-category-ink-strong hover:bg-category-soft-strong`}
        title="Change category"
      >
        <Icon name={category?.icon || (categoryId ? DEFAULT_CATEGORY_ICON : UNCATEGORIZED_ICON)} className="w-4 h-4 shrink-0" />
        <span className="truncate max-w-[14rem]">{label}</span>
      </button>
      {editing && (
        <CategoryDialog
          initial={categoryId}
          categories={categories}
          onSave={onSave}
          onCreated={onCreated}
          saveLabel={saveLabel}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

function CategoryDialog({ initial, categories: initialCategories, onSave, onCreated, saveLabel, onClose }: {
  initial: string | null;
  categories: CategoryOption[];
  onSave: (categoryId: string | null) => Promise<void>;
  onCreated?: (category: CategoryOption) => void;
  saveLabel?: string;
  onClose: () => void;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [categoryId, setCategoryId] = useState(initial ?? '');
  const [showNewCat, setShowNewCat] = useState(false);

  return (
    <QuickEditDialog
      title="Category"
      canSave={categoryId !== (initial ?? '') && !showNewCat}
      onSave={() => onSave(categoryId || null)}
      onClose={onClose}
      saveLabel={saveLabel}
    >
      {showNewCat ? (
        <NewCategoryInline
          onSave={async (name, icon) => {
            const created = await createCategory(name, icon);
            setCategories(prev => [...prev, created]);
            setCategoryId(created.id);
            setShowNewCat(false);
            onCreated?.(created);
          }}
          onCancel={() => setShowNewCat(false)}
        />
      ) : (
        <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} onNew={() => setShowNewCat(true)} />
      )}
    </QuickEditDialog>
  );
}
