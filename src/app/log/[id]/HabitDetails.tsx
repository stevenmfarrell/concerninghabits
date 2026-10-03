'use client';

import { useState, type ReactNode } from 'react';
import { Loader2, Lock, Repeat } from 'lucide-react';
import toast from 'react-hot-toast';
import { createCategory, setHabitCadence, setHabitCategory } from '../../actions/db';
import CategorySelect from '@/components/CategorySelect';
import NewCategoryInline from '@/components/NewCategoryInline';
import { CadencePicker, CadenceSettings } from '@/components/CadenceField';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { describeCadence, parseCadence, type Cadence } from '@/lib/cadence';
import { UNCATEGORIZED_ICON } from '@/lib/constants';
import type { CategoryOption, HabitDetail } from '@/lib/types';

const PILL = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors';

// A habit's category and cadence, under its name on its page, each changeable on the spot. Any
// member can file the habit in their own categories; only the owner can change its cadence, which
// is the same for everyone it's shared with.
export default function HabitDetails({ habit, categories }: { habit: HabitDetail; categories: CategoryOption[] }) {
  const [editing, setEditing] = useState<'category' | 'cadence' | null>(null);
  const cadence = parseCadence(habit.cadence);

  const category = categories.find(c => c.id === habit.categoryId);
  const parent = category?.parentId ? categories.find(c => c.id === category.parentId) : undefined;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => setEditing('category')}
        className={`${PILL} bg-blue-50 border-blue-100 text-blue-800 hover:bg-blue-100`}
        title="Change category"
      >
        <Icon name={category?.icon || (category ? 'List' : UNCATEGORIZED_ICON)} className="w-4 h-4 shrink-0" />
        <span className="truncate max-w-[14rem]">{category ? (parent ? `${parent.name} › ${category.name}` : category.name) : 'Uncategorized'}</span>
      </button>

      {habit.isOwner ? (
        <button
          type="button"
          onClick={() => setEditing('cadence')}
          className={`${PILL} bg-white border-stone-200 text-stone-700 hover:bg-stone-50`}
          title="Change cadence"
        >
          <Repeat className="w-4 h-4 shrink-0" />
          {describeCadence(cadence)}
        </button>
      ) : (
        <span className={`${PILL} bg-stone-50 border-stone-100 text-stone-500`} title="Set by the habit's owner">
          <Repeat className="w-4 h-4 shrink-0" />
          {describeCadence(cadence)}
          <Lock className="w-3 h-3 shrink-0" aria-label="Set by the habit's owner" />
        </span>
      )}

      {editing === 'category' && (
        <CategoryDialog habitId={habit.id} initial={habit.categoryId} categories={categories} onClose={() => setEditing(null)} />
      )}
      {editing === 'cadence' && (
        <CadenceDialog habitId={habit.id} initial={cadence} onClose={() => setEditing(null)} />
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

function CadenceDialog({ habitId, initial, onClose }: { habitId: string; initial: Cadence; onClose: () => void }) {
  const [cadence, setCadence] = useState(initial);

  return (
    <QuickEditDialog
      title="Cadence"
      canSave={JSON.stringify(cadence) !== JSON.stringify(initial)}
      onSave={async () => {
        await setHabitCadence(habitId, cadence);
        toast.success('Cadence changed');
      }}
      onClose={onClose}
    >
      <CadencePicker value={cadence} onChange={setCadence} />
      <CadenceSettings value={cadence} onChange={setCadence} />
    </QuickEditDialog>
  );
}

// A small dialog to change one thing about the habit. Saving refreshes the page through the server
// action's revalidation, then closes. Not overflow-hidden, so a dropdown inside can spill out of it.
function QuickEditDialog({ title, canSave, onSave, onClose, children }: { title: string; canSave: boolean; onSave: () => Promise<void>; onClose: () => void; children: ReactNode }) {
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave();
      onClose();
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setSaving(false);
    }
  };

  return (
    // Above the bottom nav (z-50)
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <h3 className="text-xl font-bold text-stone-900">{title}</h3>
          <div>{children}</div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={!canSave || saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
