'use client';

import { useOptimistic, useRef, useState } from 'react';
import CategoryRow, { type CategoryRowProps } from '@/components/CategoryRow';
import QuillIconWavy from '@/components/QuillIconWavy';
import { IconButton } from '@/components/ui/IconButton';
import CategoryLogDialog from './CategoryLogDialog';
import RowGesture from './RowGesture';
import { POINTER_ONLY } from './pointerOnly';
import LogRing from './LogRing';
import { zoomAway } from './zoomAway';
import type { PickerSection } from '@/lib/dueList';

// A category's list row (`row`), pressed and held, filling with its blue (see RowGesture), to pick
// one of its habits to log from a dialog of chips (see CategoryLogDialog). With a mouse, a
// button at the row's end opens it too, lined up with habit rows' Log buttons. With the row's
// `status` (the Agenda page), a ring at its start opens it on a tap instead, everywhere (see LogRing),
// filling as soon as a habit's picked, and the row zooms away once that makes it done (see zoomAway).
export default function CategoryHoldToLog({ category, row }: {
  category: { name: string; icon: string | null; sections: PickerSection[] };
  row: CategoryRowProps;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const open = () => setIsOpen(true);
  const label = `Log a habit in ${category.name}`;
  const rowRef = useRef<HTMLDivElement>(null);
  // Entries being logged from the picker that the page doesn't show yet (see useHabitLogger)
  const [pending, addPending] = useOptimistic(0, (count, added: number) => count + added);
  const { status } = row;

  // As a habit in it starts logging, in that entry's transition
  const leave = () => {
    if (!status) return undefined;
    addPending(1);
    return status.done + pending + 1 >= status.needed ? zoomAway(rowRef.current) : undefined;
  };

  return (
    <div ref={rowRef}>
      <RowGesture onCommit={open} label={label} tone="category" hiddenButton={!status}>
        {status ? (
          <CategoryRow {...row} leading={<LogRing status={status} pending={pending} label={label} onClick={open} color="blue" />} />
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
      {isOpen && <CategoryLogDialog category={category} onClose={() => setIsOpen(false)} leave={leave} />}
    </div>
  );
}
