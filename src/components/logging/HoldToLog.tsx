'use client';

import type { ReactNode } from 'react';
import { LogIconButton } from './LogHabitButton';
import LogEntrySheet from './LogEntrySheet';
import RowGesture from './RowGesture';
import { POINTER_ONLY } from './pointerOnly';
import { useHabitLogger, type HabitLogger, type LoggableHabit } from './useHabitLogger';
import type { Leaving } from './zoomAway';

// A habit's list row, logged by pressing and holding it (see RowGesture), the same as the row's
// Log button would: a habit with no form is logged at once; one with a form opens the entry sheet.
// With a mouse, the row keeps its Log button too: `children` is given it, to place in the row, and
// the logger, for a row with a button of its own that logs it everywhere instead (`ownButton`, e.g.
// an Agenda row's ring, see LogRing). `leave` sends the row away once it's done (see useHabitLogger).
export default function HoldToLog({ habit, ownButton = false, leave, children }: {
  habit: LoggableHabit;
  ownButton?: boolean;
  leave?: () => Leaving | undefined;
  children: (logButton: ReactNode, logger: HabitLogger) => ReactNode;
}) {
  const logger = useHabitLogger(habit, { leave });

  return (
    <>
      <RowGesture
        onCommit={logger.start}
        label={logger.hasForm ? `Log ${habit.name} (opens a form)` : `Log ${habit.name}`}
        busy={logger.busy}
        hiddenButton={!ownButton}
      >
        {children(ownButton ? null : <span className={POINTER_ONLY}><LogIconButton logger={logger} /></span>, logger)}
      </RowGesture>
      {logger.sheetOpen && <LogEntrySheet logger={logger} />}
    </>
  );
}
