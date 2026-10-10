'use client';

import { useOptimistic, useRef, useState } from 'react';
import CategoryRow, { type CategoryRowProps } from '@/components/CategoryRow';
import QuillIconWavy from '@/components/QuillIconWavy';
import { IconButton } from '@/components/ui/IconButton';
import CategoryLogDialog from './CategoryLogDialog';
import RowGesture from './RowGesture';
import { HealthMark } from '@/components/HealthPlant';
import { useSkipSwipe } from './skipping';
import { POINTER_ONLY } from './pointerOnly';
import LogRing from './LogRing';
import { zoomAway } from './zoomAway';
import type { PickerSection } from '@/lib/dueList';

// A category's list row (`row`), pressed and held, filling with its blue (see RowGesture), to pick
// one of its habits to log from a dialog of chips (see CategoryLogDialog). With a mouse, a
// button at the row's end opens it too, lined up with habit rows' Log buttons. With the row's
// `status` (the Agenda and Habits pages), a ring at its start opens it on a tap instead, everywhere
// (see LogRing), filling as soon as a habit's picked. With `leavesWhenDone` (the Agenda), the row
// zooms away once that makes it done (see zoomAway), and one that can be skipped now (its status's
// `skip`) is skipped (or postponed) by swiping it to the left, going the same way. With `health`
// (the Habits page), its health is at its start instead of a ring (see HealthMark), and it keeps the
// button at its end.
export default function CategoryHoldToLog({ category, row, leavesWhenDone = false, health = false }: {
  category: { id: string; name: string; icon: string | null; sections: PickerSection[] };
  row: CategoryRowProps;
  leavesWhenDone?: boolean;
  health?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const open = () => setIsOpen(true);
  const label = `Log a habit in ${category.name}`;
  const rowRef = useRef<HTMLDivElement>(null);
  // Entries being logged from the picker that the page doesn't show yet (see useHabitLogger)
  const [pending, addPending] = useOptimistic(0, (count, added: number) => count + added);
  const { status } = row;
  // Its ring, which opens the picker in place of the button at its end
  const ring = !!status && !health;

  // As a habit in it starts logging, in that entry's transition
  const leave = () => {
    if (!ring) return undefined;
    addPending(1);
    return leavesWhenDone && status.done + pending + 1 >= status.needed ? zoomAway(rowRef.current) : undefined;
  };

  const swipe = useSkipSwipe({ kind: 'category', id: category.id, name: category.name }, leavesWhenDone ? status?.skip : undefined, rowRef);

  return (
    <div ref={rowRef}>
      <RowGesture onCommit={open} label={label} tone="category" hiddenButton={!ring} swipe={swipe}>
        {ring ? (
          <CategoryRow {...row} leading={<LogRing status={status} pending={pending} label={label} onClick={open} color="blue" />} />
        ) : (
          <CategoryRow
            {...row}
            leading={health ? <HealthMark consistency={status?.consistency} /> : undefined}
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
