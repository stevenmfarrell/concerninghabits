import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import Icon from './Icon';
import RowStatus from './RowStatus';
import ActivityCalendar from './ActivityCalendar';
import CadenceLabel from './CadenceLabel';
import type { Cadence } from '@/lib/cadence';
import type { RowStatus as Status } from '@/lib/dueList';

export interface CategoryRowProps {
  href: string;
  name: string;
  icon: string;
  // A line under the name, e.g. "7 habits · Daily" on the Habits page
  subtitle?: string;
  // Its cadence under the name instead (none without one), as habit rows show theirs on the Agenda
  // and Habits pages (see CadenceLabel)
  showCadence?: boolean;
  // Every entry on the category's habits, for its calendar
  dates: Date[];
  habitCount: number;
  // The category's own cadence, or none
  cadence: Cadence;
  // What the Agenda page shows beside its calendar: how far off it's due (see RowStatus)
  status?: Status;
  // A button at the row's start in place of its icon's tile, beside its link rather than in it, e.g.
  // the ring that logs it on the Agenda page (see LogRing); its icon goes before its name instead
  leading?: ReactNode;
  // Lines its status and calendar up with habit rows' in a list alongside them (the Agenda page),
  // by leaving out its chevron, since those rows end at their calendars, and matching their spacing
  alignWithHabitRows?: boolean;
  // A button at the row's end, beside its link rather than in it, e.g. the button to pick a habit in
  // it to log, shown only with a mouse (see pointerOnly); it takes the chevron's place there
  action?: ReactNode;
  bedtime: string;
  weekStartsOn: string;
  timeZone: string;
}

// A category as a row in a list, linking to its page: its name and a line about it, and a
// calendar of its recent entries (shaded by its cadence, or by how many of its habits were logged)
export default function CategoryRow({ href, name, icon, subtitle, showCadence, dates, habitCount, cadence, status, leading, alignWithHabitRows, action, bedtime, weekStartsOn, timeZone }: CategoryRowProps) {
  const padding = 'pane-inset py-3';
  const buttons = action || leading;
  return (
    // Without buttons, the whole row is the link, padding and all. With them, the padding is the
    // row's, as a habit row's is, since pane-inset can't be split between the row and its link (a
    // percentage padding is of the parent's width, which the other side's padding has narrowed).
    // With them, the link is stretched over the row (its ::after) so the padding is still
    // tappable, with the buttons above it
    <div className={`relative flex items-center ${leading ? 'gap-4 sm:gap-5' : 'gap-2 sm:gap-4'} transition-colors bg-surface hover:bg-surface-subtle group/row ${buttons ? padding : ''}`}>
      {leading}
      <Link href={href} className={`flex-1 flex items-center gap-3 sm:gap-6 min-w-0 ${buttons ? 'after:absolute after:inset-0' : padding}`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {!leading && (
            <div className="w-10 h-10 rounded-xl bg-category-soft-strong flex items-center justify-center text-category-ink-strong transition-colors shrink-0">
              <Icon name={icon} className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-semibold text-ink group-hover/row:text-category-ink-strong transition-colors flex items-center gap-1.5 min-w-0`}>
              {leading && <Icon name={icon} className="w-4 h-4 shrink-0 text-category-ink" />}
              <span className="truncate">{name}</span>
            </h3>
            {showCadence ? cadence.type !== 'none' && <CadenceLabel cadence={cadence} weekStartsOn={weekStartsOn} /> : subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
          </div>
        </div>

        <div className={`shrink-0 flex items-center ${alignWithHabitRows ? 'gap-4' : 'gap-3'}`}>
          {status && <RowStatus days={status.dueInDays} />}
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
        {!alignWithHabitRows && (
          <div className={`shrink-0 text-ink-faint group-hover/row:text-category-ink transition-colors ${action ? 'pointer-fine:hidden' : ''}`}>
            <ChevronRight className="w-5 h-5" />
          </div>
        )}
      </Link>
      {action && <div className="relative z-10 shrink-0 flex">{action}</div>}
    </div>
  );
}
