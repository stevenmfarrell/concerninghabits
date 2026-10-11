'use client';

import toast from 'react-hot-toast';
import CadenceQuickEdit from '@/components/CadenceQuickEdit';
import { setCategoryCadence } from '@/app/actions/categories';
import type { Cadence } from '@/lib/cadence';

// A category's cadence on its page, changeable on the spot (a category is always its user's own).
// `weekStartsOn` is the user's, for the days of the week.
export default function CategoryCadence({ categoryId, cadence, weekStartsOn }: { categoryId: string; cadence: Cadence; weekStartsOn: string }) {
  return (
    <CadenceQuickEdit
      cadence={cadence}
      weekStartsOn={weekStartsOn}
      onSave={async next => {
        await setCategoryCadence(categoryId, next);
        toast.success('Cadence changed');
      }}
    />
  );
}
