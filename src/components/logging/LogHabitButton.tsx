'use client';

import { IconButton } from '@/components/ui/IconButton';
import LogButtonIcon from './LogButtonIcon';
import LogEntrySheet from './LogEntrySheet';
import { useHabitLogger, type LoggableHabit } from './useHabitLogger';

// A list row's Log button: the same workflow as the Log Habit button on the habit's page, without
// leaving the list. A habit with no form is logged on the tap; one with a form opens the entry sheet,
// which its icon shows. Every row's button is the same width, so they line up down the list.
// Pale rather than filled, so a column of them doesn't outweigh the rows.
export default function LogHabitButton({ habit }: { habit: LoggableHabit }) {
  const logger = useHabitLogger(habit);

  return (
    <>
      <IconButton
        variant="soft"
        onClick={logger.start}
        disabled={logger.busy}
        title={logger.hasForm ? `Log ${habit.name} (opens a form)` : `Log ${habit.name}`}
        aria-label={logger.hasForm ? `Log ${habit.name} (opens a form)` : `Log ${habit.name}`}
        className="w-16 h-10"
      >
        <LogButtonIcon hasForm={logger.hasForm} busy={logger.busy} />
      </IconButton>
      {logger.sheetOpen && <LogEntrySheet logger={logger} />}
    </>
  );
}
