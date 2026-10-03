'use client';

import { useState } from 'react';
import Select from './Select';
import { CADENCE_TYPES, type Cadence, type CadenceType } from '@/lib/cadence';

// Each cadence as the editor offers it: its name in the picker, and what it starts as when picked.
// Keyed by every cadence type, so a new one doesn't build until it's given a place here.
const CADENCE_OPTIONS: { [T in CadenceType]: { label: string; initial: () => Extract<Cadence, { type: T }> } } = {
  daily: { label: 'Daily', initial: () => ({ type: 'daily', timesPerDay: 1 }) },
  everyNDays: { label: 'Every N days', initial: () => ({ type: 'everyNDays', days: 2 }) },
  calendarWeek: { label: 'Once per calendar week', initial: () => ({ type: 'calendarWeek' }) },
  calendarMonth: { label: 'Once per calendar month', initial: () => ({ type: 'calendarMonth' }) },
  none: { label: 'No set cadence', initial: () => ({ type: 'none' }) },
};

const NUMBER_INPUT_CLASS = 'w-full sm:w-32 h-[42px] px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm';

// The cadence picker. The setting the chosen cadence needs, if any, is CadenceSettings, which
// HabitEditor shows below its row of pickers.
export function CadencePicker({ value, onChange, disabled }: { value: Cadence; onChange: (cadence: Cadence) => void; disabled?: boolean }) {
  return (
    <Select
      value={value.type}
      onChange={type => onChange(type === value.type ? value : CADENCE_OPTIONS[type as CadenceType].initial())}
      options={CADENCE_TYPES.map(type => ({ id: type, label: CADENCE_OPTIONS[type].label }))}
      disabled={disabled}
    />
  );
}

export function CadenceSettings({ value, onChange, disabled }: { value: Cadence; onChange: (cadence: Cadence) => void; disabled?: boolean }) {
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
    case 'calendarWeek':
    case 'calendarMonth':
    case 'none':
      return null;
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
      <label className="block text-sm font-semibold text-stone-700 mb-1">
        {label}
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          className={`${NUMBER_INPUT_CLASS} block mt-2 font-normal`}
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
      <p className="text-xs text-stone-500 mt-1">{help}</p>
    </div>
  );
}
