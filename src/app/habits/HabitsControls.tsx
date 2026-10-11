'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowDownNarrowWide, ArrowDownWideNarrow, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { MENU_PANEL, MenuBackdrop, menuOptionClasses } from '@/components/ui/Menu';
import {
  defaultHabitsDir, HABITS_DIR_COOKIE, HABITS_DIR_LABELS, HABITS_SORT_COOKIE, HABITS_SORT_LABELS, HABITS_SORTS, HABITS_VIEW_COOKIE,
  type HabitsDir, type HabitsSort, type HabitsView,
} from '@/lib/habitsView';

const VIEWS = [
  { value: 'categories' as const, label: 'Categories' },
  { value: 'habits' as const, label: 'All Habits' },
];

// Remembered for a year
function remember(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

interface Choice {
  view: HabitsView;
  sort: HabitsSort;
  dir: HabitsDir;
}

// Changes the Habits page's view or sort, remembering each in a cookie (as a habit page's time range
// is) and putting it in the URL
function useChoose({ view, sort, dir }: Choice) {
  const router = useRouter();
  const pathname = usePathname();
  return (next: Partial<Choice>) => {
    // A newly chosen sort starts out going its usual way
    const chosen = { view, sort, dir: next.sort && next.sort !== sort ? defaultHabitsDir(next.sort) : dir, ...next };
    remember(HABITS_VIEW_COOKIE, chosen.view);
    remember(HABITS_SORT_COOKIE, chosen.sort);
    remember(HABITS_DIR_COOKIE, chosen.dir);
    router.replace(`${pathname}?view=${chosen.view}&sort=${chosen.sort}&dir=${chosen.dir}`, { scroll: false });
  };
}

// Whether the Habits page lists categories or every habit, as a segmented control centered above
// the list, on the page's background
export function HabitsViewSwitcher(choice: Choice) {
  const choose = useChoose(choice);
  return (
    <div className="max-w-xs mx-auto">
      <SegmentedControl size="md" label="Show" options={VIEWS} value={choice.view} onChange={view => choose({ view })} />
    </div>
  );
}

// The Habits list's heading controls: how it's sorted, and which way (flipped by the button beside
// the sort, the user's own order included, which it reverses)
export default function HabitsSortControls(choice: Choice) {
  const { sort, dir } = choice;
  const choose = useChoose(choice);
  const [isOpen, setIsOpen] = useState(false);

  const flipped: HabitsDir = dir === 'asc' ? 'desc' : 'asc';

  return (
    <>
      <div className="relative">
        <Button variant="ghost" size="xs" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} aria-label={`Sort by ${HABITS_SORT_LABELS[sort]}`}>
          {HABITS_SORT_LABELS[sort]}
          <ChevronDown className="w-4 h-4 shrink-0" />
        </Button>
        {isOpen && (
          <>
            <MenuBackdrop onClose={() => setIsOpen(false)} />
            <div className={`${MENU_PANEL} absolute right-0 top-full mt-1 w-44`} role="menu">
              {HABITS_SORTS.map(option => (
                <button
                  key={option}
                  type="button"
                  role="menuitemradio"
                  aria-checked={option === sort}
                  className={`${menuOptionClasses(option === sort)} px-4`}
                  onClick={() => {
                    setIsOpen(false);
                    choose({ sort: option });
                  }}
                >
                  <span className="flex-1">{HABITS_SORT_LABELS[option]}</span>
                  {option === sort && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <IconButton
        size="sm"
        onClick={() => choose({ dir: flipped })}
        title={`${HABITS_DIR_LABELS[sort][dir]} (tap for ${HABITS_DIR_LABELS[sort][flipped].toLowerCase()})`}
        aria-label={`${HABITS_DIR_LABELS[sort][dir]}. Switch to ${HABITS_DIR_LABELS[sort][flipped].toLowerCase()}`}
      >
        {dir === 'asc' ? <ArrowDownNarrowWide className="w-5 h-5" /> : <ArrowDownWideNarrow className="w-5 h-5" />}
      </IconButton>
    </>
  );
}
