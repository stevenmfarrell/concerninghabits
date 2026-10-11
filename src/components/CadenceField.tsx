'use client';

import { useState } from 'react';
import Select from './Select';
import { CADENCE_TYPES, toggleWeekday, weekdaysInOrder, withTimes, type Cadence, type CadenceType, type LimitPeriod } from '@/lib/cadence';
import { INPUT_SM } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

// Each cadence as the editor offers it: its name in the picker, and what it starts as when picked.
// Keyed by every cadence type, so a new one doesn't build until it's given a place here.
const CADENCE_OPTIONS: { [T in CadenceType]: { label: string; initial: () => Extract<Cadence, { type: T }> } } = {
  daily: { label: 'Daily', initial: () => ({ type: 'daily', timesPerDay: 1 }) },
  everyNDays: { label: 'Every N days', initial: () => ({ type: 'everyNDays', days: 2 }) },
  weekdays: { label: 'On certain days', initial: () => ({ type: 'weekdays', days: [1, 2, 3, 4, 5] }) },
  calendarWeek: { label: 'Weekly', initial: () => ({ type: 'calendarWeek' }) },
  calendarMonth: { label: 'Monthly', initial: () => ({ type: 'calendarMonth' }) },
  none: { label: 'No set cadence', initial: () => ({ type: 'none' }) },
  limit: { label: 'At most (a limit)', initial: () => ({ type: 'limit', period: 'day', max: 1 }) },
};

const LIMIT_PERIOD_OPTIONS: { value: LimitPeriod; label: string }[] = [
  { value: 'day', label: 'A day' },
  { value: 'week', label: 'A week' },
  { value: 'month', label: 'A month' },
];

// The cadence picker. The setting the chosen cadence needs, if any, is CadenceSettings, which
// HabitEditor shows below its row of pickers.
export function CadencePicker({ value, onChange, disabled }: { value: Cadence; onChange: (cadence: Cadence) => void; disabled?: boolean }) {
  return (
    <Select
      value={value.type}
      onChange={type => onChange(type === value.type ? value : CADENCE_OPTIONS[type as CadenceType].initial())}
      options={CADENCE_TYPES.map(type => ({ id: type, label: CADENCE_OPTIONS[type].label }))}
      disabled={disabled}
      size="sm"
    />
  );
}

// `weekStartsOn` is the user's, to lay out the days of the week as their weeks run
export function CadenceSettings({ value, onChange, disabled, weekStartsOn }: { value: Cadence; onChange: (cadence: Cadence) => void; disabled?: boolean; weekStartsOn: string }) {
  switch (value.type) {
    case 'daily':
      return (
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
    case 'everyNDays':
      return (
        <CadenceNumber
          key="everyNDays"
          label="Days apart"
          help="An entry counts for its own day and the days after it, then it's due again."
          value={value.days}
          min={2}
          max={365}
          onChange={days => onChange({ ...value, days })}
          disabled={disabled}
        />
      );
    case 'weekdays':
      return <WeekdayPicker key="weekdays" days={value.days} onChange={days => onChange({ ...value, days })} disabled={disabled} weekStartsOn={weekStartsOn} />;
    case 'calendarWeek':
      return (
        <CadenceNumber
          key="calendarWeek"
          label="Times a week"
          help="How many entries a week it takes to be done. Weeks begin on your week's start day."
          value={value.times ?? 1}
          min={1}
          max={100}
          onChange={times => onChange(withTimes(value, times))}
          disabled={disabled}
        />
      );
    case 'calendarMonth':
      return (
        <CadenceNumber
          key="calendarMonth"
          label="Times a month"
          help="How many entries a month it takes to be done. Months begin on the 1st."
          value={value.times ?? 1}
          min={1}
          max={100}
          onChange={times => onChange(withTimes(value, times))}
          disabled={disabled}
        />
      );
    case 'none':
      return null;
    case 'limit':
      return (
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
    default: {
      const unhandled: never = value;
      return unhandled;
    }
  }
}

// A cadence's whole-number setting. What's typed is kept as typed (so "10" can be typed through
// "1"), and only passed on while it's in range; leaving the field puts it back in range.
function CadenceNumber({ label, help, value, min, max, onChange, disabled }: { label: string; help: string; value: number; min: number; max: number; onChange: (value: number) => void; disabled?: boolean }) {
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
    </div>
  );
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
