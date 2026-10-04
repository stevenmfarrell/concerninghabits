'use client';

import toast from 'react-hot-toast';
import { setHabitCadence, setHabitCategory } from '../../actions/db';
import CadenceQuickEdit from '@/components/CadenceQuickEdit';
import CategoryQuickEdit from '@/components/CategoryQuickEdit';
import { parseCadence } from '@/lib/cadence';
import type { CategoryOption, HabitDetail } from '@/lib/types';

// A habit's category and cadence, under its name on its page, each changeable on the spot. Any
// member can file the habit in their own categories; only the owner can change its cadence, which
// is the same for everyone it's shared with.
export default function HabitDetails({ habit, categories }: { habit: HabitDetail; categories: CategoryOption[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <CategoryQuickEdit
        categoryId={habit.categoryId}
        categories={categories}
        onSave={async categoryId => {
          await setHabitCategory(habit.id, categoryId);
          toast.success('Category changed');
        }}
      />
      <CadenceQuickEdit
        cadence={parseCadence(habit.cadence)}
        onSave={habit.isOwner ? async next => {
          await setHabitCadence(habit.id, next);
          toast.success('Cadence changed');
        } : undefined}
        lockedTitle="Set by the habit's owner"
      />
    </div>
  );
}
