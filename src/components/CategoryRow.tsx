import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import Icon from './Icon';
import RowStatus from './RowStatus';
import ActivityCalendar from './ActivityCalendar';
import type { Cadence } from '@/lib/cadence';
import type { RowStatus as Status } from '@/lib/dueList';

interface CategoryRowProps {
  href: string;
  name: string;
  icon: string;
  // A line under the name, e.g. "7 habits · Daily" on the Habits page
  subtitle?: string;
  // Every entry on the category's habits, for its calendar
  dates: Date[];
  habitCount: number;
  // The category's own cadence, or none
  cadence: Cadence;
  // What the Agenda page shows beside its calendar, e.g. a progress ring (see RowStatus)
  status?: Status;
  // Lines its status and calendar up with habit rows' in a list alongside them (the Agenda page),
  // by giving its chevron the room, and the gap before it, of a habit row's Log button
  alignWithHabitRows?: boolean;
  bedtime: string;
  weekStartsOn: string;
  timeZone: string;
}

// A category as a row in a list, linking to its page: its name and a line about it, and a
// calendar of its recent entries (shaded by its cadence, or by how many of its habits were logged)
export default function CategoryRow({ href, name, icon, subtitle, dates, habitCount, cadence, status, alignWithHabitRows, bedtime, weekStartsOn, timeZone }: CategoryRowProps) {
  return (
    <Link
      href={href}
      className="flex items-stretch transition-colors bg-surface hover:bg-surface-subtle group/row"
    >
      <div className="flex-1 flex items-center py-3 pane-inset gap-3 sm:gap-6 min-w-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-category-soft-strong flex items-center justify-center text-category-ink-strong transition-colors shrink-0">
            <Icon name={icon} className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-ink group-hover/row:text-category-ink-strong transition-colors truncate">
              {name}
            </h3>
            {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
          </div>
        </div>

        {/* The ring goes before the calendar, so calendars line up down the list with or without one */}
        <div className="shrink-0 flex items-center gap-3">
          {status && <RowStatus status={status} color="blue" />}
          <div className="opacity-80 group-hover/row:opacity-100 transition-opacity">
            <ActivityCalendar
              dates={dates}
              weeks={4}
              size="xs"
              {...(cadence.type === 'none' ? { density: habitCount } : { cadence })}
              bedtime={bedtime}
              weekStartsOn={weekStartsOn}
              timeZone={timeZone}
              color="blue"
              emptyColor="bg-surface-strong/70"
              futureColor="bg-transparent"
            />
          </div>
        </div>
        <div className={`shrink-0 text-ink-faint group-hover/row:text-category-ink transition-colors ${alignWithHabitRows ? 'w-16 flex justify-center -ml-1 sm:-ml-2' : ''}`}>
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>
    </Link>
  );
}
