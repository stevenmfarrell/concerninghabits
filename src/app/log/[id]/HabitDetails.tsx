'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { createCategory, setHabitCadence, setHabitCategory } from '../../actions/db';
import CategorySelect from '@/components/CategorySelect';
import NewCategoryInline from '@/components/NewCategoryInline';
import CadenceQuickEdit from '@/components/CadenceQuickEdit';
import QuickEditDialog from '@/components/QuickEditDialog';
import Icon from '@/components/Icon';
import { parseCadence } from '@/lib/cadence';
import { UNCATEGORIZED_ICON } from '@/lib/constants';
import type { CategoryOption, HabitDetail } from '@/lib/types';

const PILL = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors';

// A habit's category and cadence, under its name on its page, each changeable on the spot. Any
// member can file the habit in their own categories; only the owner can change its cadence, which
// is the same for everyone it's shared with.
export default function HabitDetails({ habit, categories }: { habit: HabitDetail; categories: CategoryOption[] }) {
  const [editingCategory, setEditingCategory] = useState(false);
  const cadence = parseCadence(habit.cadence);

  const category = categories.find(c => c.id === habit.categoryId);
  const parent = category?.parentId ? categories.find(c => c.id === category.parentId) : undefined;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => setEditingCategory(true)}
        className={`${PILL} bg-blue-50 border-blue-100 text-blue-800 hover:bg-blue-100`}
        title="Change category"
      >
        <Icon name={category?.icon || (category ? 'List' : UNCATEGORIZED_ICON)} className="w-4 h-4 shrink-0" />
        <span className="truncate max-w-[14rem]">{category ? (parent ? `${parent.name} › ${category.name}` : category.name) : 'Uncategorized'}</span>
      </button>

      <CadenceQuickEdit
        cadence={cadence}
        onSave={habit.isOwner ? next => setHabitCadence(habit.id, next) : undefined}
        lockedTitle="Set by the habit's owner"
      />

      {editingCategory && (
        <CategoryDialog habitId={habit.id} initial={habit.categoryId} categories={categories} onClose={() => setEditingCategory(false)} />
      )}
    </div>
  );
}

function CategoryDialog({ habitId, initial, categories: initialCategories, onClose }: { habitId: string; initial: string | null; categories: CategoryOption[]; onClose: () => void }) {
  const [categories, setCategories] = useState(initialCategories);
  const [categoryId, setCategoryId] = useState(initial ?? '');
  const [showNewCat, setShowNewCat] = useState(false);

  return (
    <QuickEditDialog
      title="Category"
      canSave={categoryId !== (initial ?? '') && !showNewCat}
      onSave={async () => {
        await setHabitCategory(habitId, categoryId || null);
        toast.success('Category changed');
      }}
      onClose={onClose}
    >
      {showNewCat ? (
        <NewCategoryInline
          onSave={async (name, icon) => {
            const created = await createCategory(name, icon);
            setCategories(prev => [...prev, created]);
            setCategoryId(created.id);
            setShowNewCat(false);
          }}
          onCancel={() => setShowNewCat(false)}
        />
      ) : (
        <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} onNew={() => setShowNewCat(true)} />
      )}
    </QuickEditDialog>
  );
}
