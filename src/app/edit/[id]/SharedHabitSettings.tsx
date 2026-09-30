'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, LogOut, Save } from 'lucide-react';
import { createCategory, getCategories, leaveHabit, setHabitAiContext, setHabitCategory } from '../../actions/db';
import AiContextField from '@/components/AiContextField';
import CategorySelect from '@/components/CategorySelect';
import NewCategoryInline from '@/components/NewCategoryInline';
import ConfirmDialog from '@/components/ConfirmDialog';
import PersonLabel from '@/components/PersonLabel';
import { Button } from '@/components/ui/Button';
import type { CategoryOption, HabitDetail } from '@/lib/types';
import type { Person } from '@/lib/userColors';

// The edit page for someone a habit is shared with: they can't change its form, but they choose
// where it sits in their own category tree, keep their own context for AI on it, or remove it from their lists.
export default function SharedHabitSettings({ habit, owner }: { habit: HabitDetail; owner: Person | undefined }) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryId, setCategoryId] = useState(habit.categoryId || '');
  const [aiContext, setAiContext] = useState(habit.aiContext || '');
  const [showNewCat, setShowNewCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  const categoryChanged = categoryId !== (habit.categoryId || '');
  const aiContextChanged = aiContext.trim() !== (habit.aiContext || '');

  const handleSave = async () => {
    setSaving(true);
    try {
      if (categoryChanged) await setHabitCategory(habit.id, categoryId || null);
      if (aiContextChanged) await setHabitAiContext(habit.id, aiContext);
      toast.success('Changes saved');
      router.push('/');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save changes');
      setSaving(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await leaveHabit(habit.id);
      router.push('/');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove habit');
      setLeaving(false);
      setShowConfirmLeave(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-stone-900">{habit.name}</h1>
        <p className="text-stone-600">
          Shared with you by <PersonLabel person={owner} size="sm" className="align-middle" />. Only they can change its form.
        </p>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 space-y-4">
        <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wider">Your Category</h2>
        <p className="text-sm text-stone-500">Where this habit appears in your own lists. It doesn&apos;t change anyone else&apos;s.</p>
        <div className="w-full sm:w-[260px]">
          {showNewCat ? (
            <NewCategoryInline
              onSave={async (name, icon) => {
                const newCat = await createCategory(name, icon);
                setCategories([...categories, newCat]);
                setCategoryId(newCat.id);
                setShowNewCat(false);
              }}
              onCancel={() => setShowNewCat(false)}
            />
          ) : (
            <CategorySelect
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              onNew={() => setShowNewCat(true)}
              disabled={saving}
            />
          )}
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100">
        <AiContextField value={aiContext} onChange={setAiContext} disabled={saving} />
      </div>

      <div className="flex flex-col-reverse md:flex-row justify-between items-center gap-4 pt-4">
        <Button
          type="button"
          variant="danger-ghost"
          size="xl"
          onClick={() => setShowConfirmLeave(true)}
          disabled={saving || leaving}
          className="w-full md:w-auto"
        >
          <LogOut className="w-5 h-5" />
          Remove from My Habits
        </Button>
        <Button
          variant="primary"
          size="xl"
          onClick={handleSave}
          disabled={saving || showNewCat || leaving || (!categoryChanged && !aiContextChanged)}
          className="w-full md:w-auto"
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
          Save Changes
        </Button>
      </div>

      <ConfirmDialog
        isOpen={showConfirmLeave}
        title="Remove Shared Habit"
        message={`Remove "${habit.name}" from your habits? You'll stop seeing it, but the entries you logged stay in its history. ${owner?.name ?? 'The owner'} can share it with you again.`}
        confirmText="Remove"
        isProcessing={leaving}
        onConfirm={handleLeave}
        onCancel={() => setShowConfirmLeave(false)}
      />
    </div>
  );
}
