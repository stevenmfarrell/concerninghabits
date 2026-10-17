'use client';

import { useState } from 'react';
import Select from './Select';
import { cadenceExample } from '@/lib/cadenceExample';
import { toggleWeekday, weekdaysInOrder, withTimes, type Cadence, type LimitPeriod } from '@/lib/cadence';
import { INPUT_SM } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

// The cadence picker: first how often (none, daily, weekly, monthly, every N days, or a limit), then
// within weekly and monthly, which kind (counted from the last time, a number of times in the
// calendar week or month, or certain days of the week), with what that needs set. A frequency comes
// first because that's how people think of a habit; the kinds beneath it are where the calendar
// and counting from the last time differ, each worked through from today (see cadenceExample).

type Group = 'none' | 'daily' | 'weekly' | 'monthly' | 'everyNDays' | 'limit';

const GROUPS: { id: Group; label: string; initial: () => Cadence }[] = [
  { id: 'none', label: 'No set cadence', initial: () => ({ type: 'none' }) },
  { id: 'daily', label: 'Daily', initial: () => ({ type: 'daily', timesPerDay: 1 }) },
  // Counted from the last time unless they choose otherwise: right for upkeep, and near enough for
  // most weekly goals
  { id: 'weekly', label: 'Weekly', initial: () => ({ type: 'everyNDays', days: 7 }) },
  { id: 'monthly', label: 'Monthly', initial: () => ({ type: 'calendarMonth' }) },
  { id: 'everyNDays', label: 'Every N days', initial: () => ({ type: 'everyNDays', days: 2 }) },
  { id: 'limit', label: 'At most (a limit)', initial: () => ({ type: 'limit', period: 'day', max: 1 }) },
];

// Where a saved cadence is offered: every 7 days is weekly, every 30 days monthly
export function cadenceGroup(cadence: Cadence): Group {
  switch (cadence.type) {
    case 'everyNDays':
      return cadence.days === 7 ? 'weekly' : cadence.days === 30 ? 'monthly' : 'everyNDays';
    case 'weekdays':
    case 'calendarWeek':
      return 'weekly';
    case 'calendarMonth':
      return 'monthly';
    default:
      return cadence.type;
  }
}

type WeeklyKind = 'every7' | 'times' | 'days';
const WEEKLY_KINDS: { value: WeeklyKind; label: string; initial: () => Cadence }[] = [
  { value: 'every7', label: 'Every 7 days', initial: () => ({ type: 'everyNDays', days: 7 }) },
  { value: 'times', label: 'Times a week', initial: () => ({ type: 'calendarWeek' }) },
  { value: 'days', label: 'On certain days', initial: () => ({ type: 'weekdays', days: [1, 2, 3, 4, 5] }) },
];

type MonthlyKind = 'times' | 'every30';
const MONTHLY_KINDS: { value: MonthlyKind; label: string; initial: () => Cadence }[] = [
  { value: 'times', label: 'Times a month', initial: () => ({ type: 'calendarMonth' }) },
  { value: 'every30', label: 'Every 30 days', initial: () => ({ type: 'everyNDays', days: 30 }) },
];

const LIMIT_PERIOD_OPTIONS: { value: LimitPeriod; label: string }[] = [
  { value: 'day', label: 'A day' },
  { value: 'week', label: 'A week' },
  { value: 'month', label: 'A month' },
];

// The cadence picker and its settings. Which group is chosen is kept here rather than worked out
// from the cadence, so typing 7 into Every N days doesn't move it to Weekly mid-edit.
// `weekStartsOn` is the user's, to lay out the days of the week as their weeks run.
export function CadenceField({ value, onChange, disabled, weekStartsOn }: { value: Cadence; onChange: (cadence: Cadence) => void; disabled?: boolean; weekStartsOn: string }) {
  const [group, setGroup] = useState(() => cadenceGroup(value));

  return (
    <>
      <Select
        value={group}
        onChange={next => {
          if (next === group) return;
          setGroup(next as Group);
          onChange(GROUPS.find(g => g.id === next)!.initial());
        }}
        options={GROUPS.map(({ id, label }) => ({ id, label }))}
        disabled={disabled}
        size="sm"
      />
      <GroupSettings group={group} value={value} onChange={onChange} disabled={disabled} weekStartsOn={weekStartsOn} />
    </>
  );
}

function GroupSettings({ group, value, onChange, disabled, weekStartsOn }: { group: Group; value: Cadence; onChange: (cadence: Cadence) => void; disabled?: boolean; weekStartsOn: string }) {
  const example = cadenceExample(value, today(), weekStartsOn);
  switch (group) {
    case 'none':
      return null;
    case 'daily':
      return value.type === 'daily' && (
        <CadenceNumber
          key="daily"
          label="Times a day"
          help="How many entries a day it takes to be done. More than one shades the calendar by how many."
          value={value.timesPerDay}
          min={1}
          max={100}
          onChange={timesPerDay => onChange({ ...value, timesPerDay })}
          disabled={disabled}
        />
      );
    case 'weekly': {
      const kind: WeeklyKind = value.type === 'calendarWeek' ? 'times' : value.type === 'weekdays' ? 'days' : 'every7';
      return (
        <>
          <KindPicker label="Weekly" options={WEEKLY_KINDS} value={kind} onChange={next => onChange(WEEKLY_KINDS.find(k => k.value === next)!.initial())} />
          {value.type === 'calendarWeek' ? (
            <CadenceNumber
              key="calendarWeek"
              label="Times a week"
              help="Any days of your calendar week: for a goal for the week, like calling your mom, or the gym 3 times a week."
              example={example}
              value={value.times ?? 1}
              min={1}
              max={100}
              onChange={times => onChange(withTimes(value, times))}
              disabled={disabled}
            />
          ) : value.type === 'weekdays' ? (
            <WeekdayPicker key="weekdays" days={value.days} onChange={days => onChange({ ...value, days })} disabled={disabled} weekStartsOn={weekStartsOn} />
          ) : (
            <KindNote help="Counted from the last time: for upkeep, like changing a filter or checking the humidifier." example={example} />
          )}
        </>
      );
    }
    case 'monthly': {
      const kind: MonthlyKind = value.type === 'everyNDays' ? 'every30' : 'times';
      return (
        <>
          <KindPicker label="Monthly" options={MONTHLY_KINDS} value={kind} onChange={next => onChange(MONTHLY_KINDS.find(k => k.value === next)!.initial())} />
          {value.type === 'calendarMonth' ? (
            <CadenceNumber
              key="calendarMonth"
              label="Times a month"
              help="Any days of the calendar month: for paying rent, or a massage twice a month."
              example={example}
              value={value.times ?? 1}
              min={1}
              max={100}
              onChange={times => onChange(withTimes(value, times))}
              disabled={disabled}
            />
          ) : (
            <KindNote help="Counted from the last time: for upkeep, like changing the furnace filter." example={example} />
          )}
        </>
      );
    }
    case 'everyNDays':
      return value.type === 'everyNDays' && (
        <CadenceNumber
          key="everyNDays"
          label="Days apart"
          help="Again that many days after the last time, like watering plants every 3 days."
          example={example}
          value={value.days}
          min={2}
          max={365}
          onChange={days => onChange({ ...value, days })}
          disabled={disabled}
        />
      );
    case 'limit':
      return value.type === 'limit' && (
        <>
          <div className="mt-4 animate-in fade-in slide-in-from-top-2">
            <p className="text-sm font-semibold text-ink-secondary mb-2" id="limit-period-label">Per</p>
            <div aria-labelledby="limit-period-label">
              <SegmentedControl size="md" label="Per" options={LIMIT_PERIOD_OPTIONS} value={value.period} onChange={period => onChange({ ...value, period })} />
            </div>
          </div>
          <CadenceNumber
            key="limit"
            label="At most"
            help="Staying at or under it keeps it healthy, and going over counts against it. 0 means avoiding it altogether. It's never due."
            value={value.max}
            min={0}
            max={100}
            onChange={max => onChange({ ...value, max })}
            disabled={disabled}
          />
        </>
      );
  }
}

// Which kind of weekly or monthly cadence, as a choice of two or three
function KindPicker<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="mt-4 animate-in fade-in slide-in-from-top-2">
      <SegmentedControl size="md" label={label} options={options.map(({ value, label }) => ({ value, label }))} value={value} onChange={onChange} />
    </div>
  );
}

// What a weekly or monthly kind with nothing to set suits, and its example from today
function KindNote({ help, example }: { help: string; example: string | null }) {
  return (
    <div className="mt-3">
      <p className="text-xs text-ink-muted">{help}</p>
      {/* Today by this browser's clock, which may differ from the server's around midnight */}
      {example && <p className="text-sm text-ink-secondary mt-2" suppressHydrationWarning>{example}</p>}
    </div>
  );
}

// A cadence's whole-number setting. What's typed is kept as typed (so "10" can be typed through
// "1"), and only passed on while it's in range; leaving the field puts it back in range.
// `example` works it through from today (see cadenceExample).
function CadenceNumber({ label, help, example, value, min, max, onChange, disabled }: { label: string; help: string; example?: string | null; value: number; min: number; max: number; onChange: (value: number) => void; disabled?: boolean }) {
  const [typed, setTyped] = useState(String(value));
  const inRange = (n: number) => Number.isInteger(n) && n >= min && n <= max;

  return (
    <div className="mt-4 animate-in fade-in slide-in-from-top-2">
      <label className="block text-sm font-semibold text-ink-secondary mb-1">
        {label}
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          className={`${INPUT_SM} sm:w-32 block mt-2 font-normal`}
          value={typed}
          onChange={e => {
            setTyped(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== '' && inRange(n)) onChange(n);
          }}
          onBlur={() => {
            const n = Number(typed);
            const fixed = typed !== '' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : value;
            setTyped(String(fixed));
            onChange(fixed);
          }}
          disabled={disabled}
        />
      </label>
      <p className="text-xs text-ink-muted mt-1">{help}</p>
      {/* Today by this browser's clock, which may differ from the server's around midnight */}
      {example && <p className="text-sm text-ink-secondary mt-2" suppressHydrationWarning>{example}</p>}
    </div>
  );
}

// Today's date by this browser's clock, as a civil date (UTC midnight), for cadenceExample
function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

// The days of the week a weekday cadence is on, as a row of toggles in the order the user's weeks
// run. Only the layout follows it: the days are stored by number whichever way round it is (see
// toggleWeekday). At least one stays on: turning off the last does nothing.
function WeekdayPicker({ days, onChange, disabled, weekStartsOn }: { days: number[]; onChange: (days: number[]) => void; disabled?: boolean; weekStartsOn: string }) {
  const toggle = (day: number) => {
    const next = toggleWeekday(days, day);
    if (next !== days) onChange(next);
  };

  return (
    <div className="mt-4 animate-in fade-in slide-in-from-top-2">
      <p className="text-sm font-semibold text-ink-secondary mb-2" id="weekday-picker-label">On these days</p>
      <div className="flex gap-1.5" role="group" aria-labelledby="weekday-picker-label">
        {weekdaysInOrder(weekStartsOn).map(({ day, name, letter }) => {
          const on = days.includes(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day)}
              disabled={disabled}
              aria-pressed={on}
              aria-label={name}
              title={name}
              className={`w-10 h-10 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 ${on ? 'bg-accent text-on-accent hover:bg-accent-hover' : 'bg-surface-subtle text-ink-muted border border-line-subtle hover:bg-surface-muted'}`}
            >
              {letter}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-muted mt-2">It&apos;s due on each of these days, and not on the others.</p>
    </div>
  );
}
