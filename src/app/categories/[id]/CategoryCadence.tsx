'use client';

import toast from 'react-hot-toast';
import CadenceQuickEdit from '@/components/CadenceQuickEdit';
import { setCategoryCadence } from '../../actions/db';
import type { Cadence } from '@/lib/cadence';

// A category's cadence on its page, changeable on the spot (a category is always its user's own)
export default function CategoryCadence({ categoryId, cadence }: { categoryId: string; cadence: Cadence }) {
  return (
    <CadenceQuickEdit
      cadence={cadence}
      onSave={async next => {
        await setCategoryCadence(categoryId, next);
        toast.success('Cadence changed');
      }}
    />
  );
}
