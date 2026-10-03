'use client';

import { useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Check, ChevronLeft, ChevronRight, Loader2, Plus, SquarePen, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/Button';
import { IconLinkButton } from '@/components/ui/IconButton';
import { showRemovedToast } from '@/components/LoggedToast';
import { HABIT_FORM_WIDGETS, habitFormUiSchema, parseHabitSchema, type HabitFormProperties } from '@/components/widgets/habitForm';
import { deleteHabitLog, logHabitEvent } from '../actions/db';
import { civilDateAtHour, parseCivilDayKey } from '@/lib/timezone';
import { formatLogValue } from '@/lib/format';

export interface DayHabit {
  id: string;
  name: string;
  schema: string;
  frequency: string;
}

export interface DayGroup {
  id: string;
  name: string;
  icon: string;
  // The category's own habits (name null), then each subcategory's
  sections: { id: string; name: string | null; habits: DayHabit[] }[];
}

interface DayEntry {
  id: string;
  habitId: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

interface TodayClientProps {
  dayKey: string;
  isToday: boolean;
  dayLabel: string;
  dateLabel: string;
  prevDayHref: string;
  // Null on today, since days ahead can't be logged
  nextDayHref: string | null;
  timeZone: string;
  groups: DayGroup[];
  initialEntries: DayEntry[];
}

function habitFormOf(habit: DayHabit) {
  const schema = parseHabitSchema(habit.schema);
  const properties = schema.properties as HabitFormProperties | undefined;
  return { schema, properties, hasForm: Object.keys(properties ?? {}).length > 0 };
}

// Every habit as a chip to check off what was done on a day. Each tap saves (or removes) a real
// entry straight away, so the chips always show what's saved:
// - a habit with no form toggles: on logs an entry, off removes it (with Undo)
// - a multiple-times-a-day habit adds an entry per tap and shows a count
// - a habit with a form opens a dialog to fill it in, or to see and remove what was logged
export default function TodayClient({ dayKey, isToday, dayLabel, dateLabel, prevDayHref, nextDayHref, timeZone, groups, initialEntries }: TodayClientProps) {
  const [entries, setEntries] = useState<DayEntry[]>(initialEntries);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [dialogHabit, setDialogHabit] = useState<DayHabit | null>(null);

  // Entries for an earlier day are logged at midday on it; today's at the current time
  const createdAt = isToday ? undefined : civilDateAtHour(parseCivilDayKey(dayKey)!, 12, timeZone);

  const entriesFor = (habitId: string) => entries.filter(e => e.habitId === habitId);
  const allHabits = groups.flatMap(g => g.sections.flatMap(s => s.habits));
  const doneCount = allHabits.filter(h => entriesFor(h.id).length > 0).length;

  // Runs a save for one habit at a time, so a double tap can't log twice
  const withBusy = async (habitId: string, work: () => Promise<void>) => {
    if (busy.has(habitId)) return;
    setBusy(prev => new Set(prev).add(habitId));
    try {
      await work();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(prev => {
        const next = new Set(prev);
        next.delete(habitId);
        return next;
      });
    }
  };

  const addEntry = async (habit: DayHabit, payload: Record<string, unknown>, at = createdAt) => {
    const log = await logHabitEvent(habit.id, payload, at);
    setEntries(prev => [...prev, { id: log.id, habitId: habit.id, payload, createdAt: log.createdAt }]);
  };

  const removeEntry = async (habit: DayHabit, entry: DayEntry) => {
    await deleteHabitLog(entry.id, habit.id);
    setEntries(prev => prev.filter(e => e.id !== entry.id));
    // Undo puts the same entry back, at its original time
    showRemovedToast(habit.name, () => withBusy(habit.id, () => addEntry(habit, entry.payload, entry.createdAt)));
  };

  const handleChipTap = (habit: DayHabit) => {
    if (habitFormOf(habit).hasForm) {
      setDialogHabit(habit);
      return;
    }
    const existing = entriesFor(habit.id);
    withBusy(habit.id, () =>
      habit.frequency !== 'multiple' && existing.length > 0
        ? removeEntry(habit, existing[existing.length - 1])
        : addEntry(habit, {})
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-stone-500 font-semibold text-sm uppercase tracking-wider mb-1">{dateLabel}</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">{dayLabel}</h1>
          <p className="text-sm text-stone-500 mt-1">
            {doneCount} of {allHabits.length} {allHabits.length === 1 ? 'habit' : 'habits'} done
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconLinkButton href={prevDayHref} title="Previous day" aria-label="Previous day">
            <ChevronLeft className="w-6 h-6" />
          </IconLinkButton>
          {nextDayHref ? (
            <IconLinkButton href={nextDayHref} title="Next day" aria-label="Next day" edge="right">
              <ChevronRight className="w-6 h-6" />
            </IconLinkButton>
          ) : (
            <span className="p-2 -mr-2 text-stone-200" aria-hidden="true">
              <ChevronRight className="w-6 h-6" />
            </span>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-stone-500 text-center py-16">No habits yet. Add some from the dashboard.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <section key={group.id} className="bg-white rounded-2xl shadow-sm border border-stone-100 p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Icon name={group.icon} className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-semibold text-stone-800">{group.name}</h2>
              </div>
              {group.sections.map(section => (
                <div key={section.id} className="space-y-2">
                  {section.name && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{section.name}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {section.habits.map(habit => (
                      <HabitChip
                        key={habit.id}
                        habit={habit}
                        count={entriesFor(habit.id).length}
                        isBusy={busy.has(habit.id)}
                        onTap={() => handleChipTap(habit)}
                        onManage={() => setDialogHabit(habit)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {dialogHabit && (
        <EntryDialog
          habit={dialogHabit}
          entries={entriesFor(dialogHabit.id)}
          dayLabel={dayLabel}
          timeZone={timeZone}
          isBusy={busy.has(dialogHabit.id)}
          onAdd={payload => withBusy(dialogHabit.id, () => addEntry(dialogHabit, payload)).then(() => setDialogHabit(null))}
          onRemove={entry => withBusy(dialogHabit.id, () => removeEntry(dialogHabit, entry))}
          onClose={() => setDialogHabit(null)}
        />
      )}
    </div>
  );
}

// A habit's chip: lit once it has an entry that day. A multiple-times-a-day habit without a form
// adds an entry per tap, so it gets a separate count segment to see and remove its entries.
function HabitChip({ habit, count, isBusy, onTap, onManage }: { habit: DayHabit; count: number; isBusy: boolean; onTap: () => void; onManage: () => void }) {
  const { hasForm } = habitFormOf(habit);
  const isOn = count > 0;
  const isMultiple = habit.frequency === 'multiple';
  const showCountSegment = isOn && isMultiple && !hasForm;

  // State-dependent styling (lit vs. not), so a custom control rather than a Button variant
  const tone = isOn
    ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
    : 'bg-white border-stone-200 text-stone-700 hover:border-emerald-300 hover:bg-emerald-50';

  return (
    <div className={`inline-flex rounded-full border transition-colors ${tone} ${isBusy ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={onTap}
        disabled={isBusy}
        aria-pressed={isOn}
        className={`inline-flex items-center gap-1.5 py-2 text-sm font-medium ${showCountSegment ? 'pl-3.5 pr-2.5' : 'px-3.5'}`}
      >
        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : isOn && <Check className="w-4 h-4" strokeWidth={3} />}
        <span>{habit.name}</span>
        {isOn && isMultiple && hasForm && <span className="text-emerald-100">×{count}</span>}
        {hasForm && !isOn && <SquarePen className="w-3.5 h-3.5 text-stone-400" aria-label="Has a form" />}
      </button>
      {showCountSegment && (
        <button
          type="button"
          onClick={onManage}
          disabled={isBusy}
          title="See or remove entries"
          aria-label={`${count} entries, see or remove`}
          className="py-2 pl-2 pr-3 text-sm font-semibold border-l border-emerald-500 text-emerald-50"
        >
          ×{count}
        </button>
      )}
    </div>
  );
}

// A habit's entries for the day, each removable, plus a way to add one: its form, or a button for
// a habit without one. Adding is offered while there's no entry yet, or any time for a
// multiple-times-a-day habit.
function EntryDialog({ habit, entries, dayLabel, timeZone, isBusy, onAdd, onRemove, onClose }: {
  habit: DayHabit;
  entries: DayEntry[];
  dayLabel: string;
  timeZone: string;
  isBusy: boolean;
  onAdd: (payload: Record<string, unknown>) => void;
  onRemove: (entry: DayEntry) => void;
  onClose: () => void;
}) {
  const { schema, properties, hasForm } = habitFormOf(habit);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const canAdd = entries.length === 0 || habit.frequency === 'multiple';

  const summarize = (payload: Record<string, unknown>) => {
    const parts = Object.entries(payload)
      .filter(([, val]) => val !== undefined && val !== null && val !== '')
      .map(([key, val]) => `${properties?.[key]?.title || key} ${formatLogValue(val, properties?.[key])}`);
    return parts.length > 0 ? parts.join(' · ') : 'Done';
  };

  return (
    // Above the bottom nav (z-50), which would otherwise cover the bottom of the sheet on phones
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={habit.name}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-xl font-bold text-stone-900">{habit.name}</h3>
            <p className="text-sm text-stone-500">{dayLabel}</p>
          </div>

          {entries.length > 0 && (
            <ul className="divide-y divide-stone-100 border border-stone-100 rounded-xl">
              {entries.map(entry => (
                <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800">{summarize(entry.payload)}</p>
                    <p className="text-xs text-stone-400">
                      {new Date(entry.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone })}
                    </p>
                  </div>
                  <Button variant="danger-ghost" size="sm" onClick={() => onRemove(entry)} disabled={isBusy}>
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {canAdd && hasForm && (
            <div className="rjsf-custom">
              <Form
                schema={{ ...schema, title: '' }}
                uiSchema={habitFormUiSchema(properties)}
                widgets={HABIT_FORM_WIDGETS}
                validator={validator}
                formData={formData}
                onChange={e => setFormData(e.formData)}
                onSubmit={() => onAdd(formData)}
                disabled={isBusy}
                noHtml5Validate
                showErrorList={false}
                className="rjsf space-y-5"
              >
                <Button type="submit" size="lg" disabled={isBusy} className="w-full">
                  {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" strokeWidth={2.5} />}
                  {entries.length > 0 ? 'Log another' : 'Log it'}
                </Button>
              </Form>
            </div>
          )}

          {canAdd && !hasForm && (
            <Button size="lg" onClick={() => onAdd({})} disabled={isBusy} className="w-full">
              <Plus className="w-5 h-5" />
              Log another
            </Button>
          )}
        </div>
        <div className="px-6 pb-6">
          <Button variant="ghost" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
