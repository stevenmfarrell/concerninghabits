'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, SkipForward } from 'lucide-react';
import Icon from '@/components/Icon';
import HoldToLog from '@/components/logging/HoldToLog';
import RowGesture from '@/components/logging/RowGesture';
import CategoryLogDialog from '@/components/logging/CategoryLogDialog';
import type { LoggableHabit } from '@/components/logging/useHabitLogger';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';
import type { PickerSection } from '@/lib/dueList';

// A Due Later category: its habits laid out to pick one to log (see rowSections)
export type ChipCategory = { id: string; name: string; icon: string | null; sections: PickerSection[] };

// The Agenda's small chips, for what isn't due (see buildDueList): Due Later's habits and categories
// done for now, and Anytime's habits with no cadence. White, on the stone, so they don't look like
// the rows above. A tap opens the habit's or category's page; pressing and holding one logs it, the
// same as holding its row would (see RowGesture): a habit at once, or by its entry sheet if it has a
// form; a category by picking one of its habits. A habit or category that's done because it was
// skipped has the skip icon; one done for now (or an Anytime habit logged today) has a check, in a
// habit's emerald or a category's blue. Links styled as chips, not buttons, so they don't use
// LinkButton.

const CHIP = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border text-sm font-medium text-ink-secondary hover:bg-surface-subtle transition-colors';

// The chip's mark at its start, if any: the skip icon, or a check in `tone`
function Mark({ skipped, done, tone }: { skipped: boolean; done: boolean; tone: 'accent' | 'category' }) {
  if (skipped) return <SkipForward className="w-3.5 h-3.5 shrink-0 text-ink-muted" strokeWidth={2.5} aria-label="Skipped" />;
  if (done) return <Check className={`w-3.5 h-3.5 shrink-0 ${tone === 'category' ? 'text-category-ink' : 'text-accent-ink'}`} strokeWidth={3} aria-label="Done" />;
  return null;
}

function ChipList({ label, children }: { label: string; children: ReactNode }) {
  return <ul className="flex flex-wrap gap-2" aria-label={label}>{children}</ul>;
}

function HabitChip({ habit, skipped, done }: { habit: LoggableHabit; skipped: boolean; done: boolean }) {
  return (
    <li>
      <HoldToLog habit={habit} className="rounded-full">
        {() => (
          <Link href={`/log/${habit.id}`} className={`${CHIP} ${done && !skipped ? 'border-accent-line-strong' : 'border-line'}`}>
            <Mark skipped={skipped} done={done} tone="accent" />
            <span className="truncate max-w-[14rem]">{habit.name}</span>
          </Link>
        )}
      </HoldToLog>
    </li>
  );
}

function CategoryChip({ category, skipped }: { category: ChipCategory; skipped: boolean }) {
  const [picking, setPicking] = useState(false);
  return (
    <li>
      <RowGesture onCommit={() => setPicking(true)} label={`Log a habit in ${category.name}`} tone="category" className="rounded-full">
        <Link href={`/categories/${category.id}`} className={`${CHIP} ${skipped ? 'border-line' : 'border-category-line'}`}>
          <Mark skipped={skipped} done tone="category" />
          <Icon name={category.icon || DEFAULT_CATEGORY_ICON} className="w-3.5 h-3.5 shrink-0 text-category-ink" />
          <span className="truncate max-w-[14rem]">{category.name}</span>
        </Link>
      </RowGesture>
      {picking && <CategoryLogDialog category={category} onClose={() => setPicking(false)} />}
    </li>
  );
}

// Due Later: habits and categories with a cadence, done for now or skipped
export function DueLaterChips({ habits, categories, skippedIds }: { habits: LoggableHabit[]; categories: ChipCategory[]; skippedIds: string[] }) {
  return (
    <ChipList label="Due Later">
      {categories.map(category => <CategoryChip key={category.id} category={category} skipped={skippedIds.includes(category.id)} />)}
      {habits.map(habit => <HabitChip key={habit.id} habit={habit} skipped={skippedIds.includes(habit.id)} done />)}
    </ChipList>
  );
}

// Anytime: habits with no cadence, checked once logged today
export function AnytimeChips({ habits, loggedTodayIds }: { habits: LoggableHabit[]; loggedTodayIds: string[] }) {
  return (
    <ChipList label="Anytime">
      {habits.map(habit => <HabitChip key={habit.id} habit={habit} skipped={false} done={loggedTodayIds.includes(habit.id)} />)}
    </ChipList>
  );
}
