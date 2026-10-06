'use client';

import { useState } from 'react';
import CategoryRow, { type CategoryRowProps } from '@/components/CategoryRow';
import QuillIconWavy from '@/components/QuillIconWavy';
import { IconButton } from '@/components/ui/IconButton';
import CategoryLogDialog from './CategoryLogDialog';
import RowGesture from './RowGesture';
import { POINTER_ONLY } from './pointerOnly';
import LogRing from './LogRing';
import type { PickerSection } from '@/lib/dueList';

// A category's list row (`row`), pressed and held, filling with its blue (see RowGesture), to pick
// one of its habits to log from a dialog of chips (see CategoryLogDialog). With a mouse, a
// button at the row's end opens it too, lined up with habit rows' Log buttons. `tip` shows the tip
// about the hold under it (see RowGesture). With the row's `status` (the Agenda page), a ring at its
// start opens it on a tap instead, everywhere (see LogRing).
export default function CategoryHoldToLog({ category, row, tip }: {
  category: { name: string; icon: string | null; sections: PickerSection[] };
  row: CategoryRowProps;
  tip?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const open = () => setIsOpen(true);
  const label = `Log a habit in ${category.name}`;

  return (
    <>
      <RowGesture onCommit={open} label={label} tone="category" hiddenButton={!row.status} tip={tip}>
        {row.status ? (
          <CategoryRow {...row} leading={<LogRing status={row.status} label={label} onClick={open} color="blue" />} />
        ) : (
          <CategoryRow
            {...row}
            action={
              <span className={POINTER_ONLY}>
                <IconButton variant="category-soft" onClick={open} title={label} aria-label={label} className="w-16 h-10">
                  <QuillIconWavy className="w-5 h-5" strokeWidth={2.5} />
                </IconButton>
              </span>
            }
          />
        )}
      </RowGesture>
      {isOpen && <CategoryLogDialog category={category} onClose={() => setIsOpen(false)} />}
    </>
  );
}
