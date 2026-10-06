'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import Icon from '@/components/Icon';
import QuillIconWavy from '@/components/QuillIconWavy';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';
import type { PickerSection } from '@/lib/dueList';
import { ClipboardList, Loader2 } from 'lucide-react';
import LogEntrySheet from './LogEntrySheet';
import { useHabitLogger, type LoggableHabit } from './useHabitLogger';

// One of the category's habits as a plain chip: a tap logs it the same as its Log button would, at
// once for a habit with no form, or by opening its entry sheet for one with a form (which a form
// icon after its name shows)
function HabitLogChip({ habit, onFormChange, onLogged }: {
  habit: LoggableHabit;
  onFormChange: (habitId: string, open: boolean) => void;
  onLogged: () => void;
}) {
  const logger = useHabitLogger(habit, { onLogged });

  useEffect(() => {
    onFormChange(habit.id, logger.sheetOpen);
  }, [habit.id, logger.sheetOpen, onFormChange]);

  return (
    <>
      <button
        type="button"
        onClick={logger.start}
        disabled={logger.busy}
        title={logger.hasForm ? `Log ${habit.name} (opens a form)` : `Log ${habit.name}`}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface border border-line text-ink font-medium hover:bg-surface-subtle hover:border-line-strong transition-colors disabled:opacity-60"
      >
        <span className="truncate max-w-[14rem]">{habit.name}</span>
        {logger.busy ? (
          <Loader2 className="w-4 h-4 shrink-0 animate-spin text-ink-muted" />
        ) : (
          logger.hasForm && <ClipboardList className="w-4 h-4 shrink-0 text-ink-subtle" aria-hidden="true" />
        )}
      </button>
      {/* Outside this dialog, which hides while it's up */}
      {logger.sheetOpen && createPortal(<LogEntrySheet logger={logger} />, document.body)}
    </>
  );
}

// A category's habits as chips in a dialog, to pick one to log (opened by holding the category's
// row on the Agenda page), in the category's order, each subcategory's under its name (see
// pickerSections). Picking a habit with a form swaps this dialog for
// the habit's entry sheet; closing that comes back here, and logging closes both. The chips stay
// mounted while hidden, since each holds its habit's logger, and it's portaled to <body> so the
// row it was opened from can't clip or offset it.
export default function CategoryLogDialog({ category, onClose }: {
  category: { name: string; icon: string | null; sections: PickerSection[] };
  onClose: () => void;
}) {
  // The habit whose entry sheet is open in place of this one
  const [formHabitId, setFormHabitId] = useState<string | null>(null);
  const onFormChange = useCallback((habitId: string, open: boolean) => {
    setFormHabitId(current => (open ? habitId : current === habitId ? null : current));
  }, []);

  return createPortal(
    <div className={formHabitId ? 'hidden' : undefined}>
      <Dialog label={`Log a habit in ${category.name}`} onClose={onClose}>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            {/* The quill says what picking a habit here does: logs it */}
            <QuillIconWavy className="w-5 h-5 shrink-0 text-category-ink" strokeWidth={2.5} />
            <h2 className="flex-1 min-w-0 text-lg font-bold text-ink truncate">Log {category.name}</h2>
            <IconButton onClick={onClose} edge="right" title="Close" aria-label="Close">
              <X className="w-5 h-5" />
            </IconButton>
          </div>
          {category.sections.map(({ subcategory, habits }, i) => (
            // The category's own habits after a subcategory get a hairline, so they don't read as that
            // subcategory's
            <section key={subcategory?.id ?? `own-${i}`} className={`space-y-2 ${!subcategory && i > 0 ? 'border-t border-line-subtle pt-4' : ''}`}>
              {subcategory && (
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  <Icon name={subcategory.icon || DEFAULT_CATEGORY_ICON} className="w-3.5 h-3.5 shrink-0 text-category-ink" />
                  <span className="truncate">{subcategory.name}</span>
                </h3>
              )}
              <ul className="flex flex-wrap gap-2" aria-label={subcategory?.name ?? 'Habits'}>
                {habits.map(habit => (
                  <li key={habit.id}>
                    <HabitLogChip habit={habit} onFormChange={onFormChange} onLogged={onClose} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Dialog>
    </div>,
    document.body,
  );
}
