'use client';

import type { ReactNode } from 'react';
import { LogIconButton } from './LogHabitButton';
import LogEntrySheet from './LogEntrySheet';
import RowGesture from './RowGesture';
import { POINTER_ONLY } from './pointerOnly';
import { useHabitLogger, type LoggableHabit } from './useHabitLogger';

// A habit's list row, logged by pressing and holding it (see RowGesture), the same as the row's
// Log button would: a habit with no form is logged at once; one with a form opens the entry sheet.
// With a mouse, the row keeps its Log button too: `children` is given it, to place in the row.
// `tip` shows the tip about the hold under it (see RowGesture).
export default function HoldToLog({ habit, tip, children }: {
  habit: LoggableHabit;
  tip?: boolean;
  children: (logButton: ReactNode) => ReactNode;
}) {
  const logger = useHabitLogger(habit);

  return (
    <>
      <RowGesture
        onCommit={logger.start}
        label={logger.hasForm ? `Log ${habit.name} (opens a form)` : `Log ${habit.name}`}
        busy={logger.busy}
        tip={tip}
      >
        {children(<span className={POINTER_ONLY}><LogIconButton logger={logger} /></span>)}
      </RowGesture>
      {logger.sheetOpen && <LogEntrySheet logger={logger} />}
    </>
  );
}
