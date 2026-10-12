'use client';

import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, ClipboardList, Info, MoreVertical, Target, X } from 'lucide-react';
import ActivityCalendar from '@/components/ActivityCalendar';
import BottomSheet from '@/components/BottomSheet';
import CadenceLabel from '@/components/CadenceLabel';
import CadenceQuickEdit, { PILL } from '@/components/CadenceQuickEdit';
import HealthHeader, { HealthMark } from '@/components/HealthPlant';
import Icon from '@/components/Icon';
import LogButtonIcon from '@/components/logging/LogButtonIcon';
import LogRing from '@/components/logging/LogRing';
import RowGesture, { type RowSwipe } from '@/components/logging/RowGesture';
import { SkipIcon } from '@/components/logging/skipping';
import PageHeader, { BELOW_HEADER } from '@/components/PageHeader';
import { PANE_INSET, PANE_SURFACE, PaneHeading, PanePage, PaneSection } from '@/components/Pane';
import QuillIconWavy from '@/components/QuillIconWavy';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { IconButton } from '@/components/ui/IconButton';
import { HABIT_FORM_WIDGETS, habitFormUiSchema } from '@/components/widgets/habitForm';
import { skipLabels } from '@/lib/cadence';
import { DAY_MS } from '@/lib/timezone';
import { isDue, valueLines, type DemoForm, type DemoHabit, type Days, type RowState, type Verdict } from './demo';

// The made-up versions of the app's pieces the tutorial's steps are tried on: the Agenda's and
// Habits page's rows, a habit's page, its entry form, and a category's picker. They look and move
// like the real ones (most are built from the same components), but only tell the tutorial what
// was done to them.

// When a habit was logged, for its calendars: its history, then its entries made today
function datesOf(habit: DemoHabit, row: RowState, now: number) {
  const past = habit.history.flatMap(daysAgo => Array<Date>(habit.perDay ?? 1).fill(new Date(now - daysAgo * DAY_MS)));
  return [...past, ...row.entries.map(() => new Date(now))];
}

const ringLabel = (habit: DemoHabit) => (habit.habits ? `Log a habit in ${habit.name}` : habit.form ? `Log ${habit.name} (opens a form)` : `Log ${habit.name}`);

// The step's goal
export function Goal({ goal, reached }: { goal: string; reached: boolean }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${reached ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface'}`}>
      {reached
        ? <CircleCheck className="w-5 h-5 shrink-0 mt-0.5 text-accent-ink" strokeWidth={2.5} />
        : <Target className="w-5 h-5 shrink-0 mt-0.5 text-accent-ink" strokeWidth={2.5} />}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{reached ? 'Goal reached' : 'Your goal'}</p>
        <p className="font-semibold text-ink">{goal}</p>
      </div>
    </div>
  );
}

// What the tutorial has to say about the last thing done. Kept below the rows on the step, so its
// coming and going doesn't move them out from under a finger.
// `onDark` is for the tutorial bar over a habit's page (see TutorialBar).
export function Said({ verdict, onDark = false, className = '' }: { verdict: Verdict | null; onDark?: boolean; className?: string }) {
  const tones = onDark
    ? { met: 'text-emerald-200', miss: 'text-amber-200', progress: 'text-emerald-50' }
    : { met: 'text-accent-ink-strong', miss: 'text-warning-ink', progress: 'text-ink-secondary' };
  return (
    <div role="status" aria-live="polite" className={verdict ? className : ''}>
      {verdict && (
        <p className={`flex items-start gap-2 font-medium ${tones[verdict.tone]}`}>
          {verdict.tone === 'met'
            ? <CircleCheck className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2.5} />
            : verdict.tone === 'miss'
              ? <CircleAlert className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2.5} />
              : <Info className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={2.5} />}
          <span>{verdict.tone === 'miss' && <strong>Not quite. </strong>}{verdict.say}</span>
        </p>
      )}
    </div>
  );
}

// Over a habit's page opened from a step: which step it is, its goal, what's been said, and the
// way on, back to the step or (once the goal's reached) to the next one. It pins under the page's
// header, on the deep emerald of the voice panel (the same in both themes, see SpeakOrType), so it
// reads as the tutorial's, not part of the made-up page under it.
export function TutorialBar({ step, of, goal, reached, verdict, onReturn, onNext }: {
  step: number;
  of: number;
  goal: string;
  reached: boolean;
  verdict: Verdict | null;
  onReturn: () => void;
  // None on the last step, which has nothing after it
  onNext?: () => void;
}) {
  return (
    <div className={`sticky ${BELOW_HEADER} z-26 bg-emerald-900 text-white shadow-lg ${PANE_INSET} py-3 space-y-2`}>
      <div className="flex items-start gap-3">
        {reached
          ? <CircleCheck className="w-5 h-5 shrink-0 mt-0.5 text-emerald-300" strokeWidth={2.5} />
          : <Target className="w-5 h-5 shrink-0 mt-0.5 text-emerald-300" strokeWidth={2.5} />}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/80">Tutorial · Step {step} of {of} · {reached ? 'Goal reached' : 'Your goal'}</p>
          <p className="font-semibold">{goal}</p>
        </div>
      </div>
      <Said verdict={verdict} onDark className="text-sm" />
      <div className="flex flex-wrap justify-end gap-2">
        {/* The way on until the goal's reached, then second to the next step */}
        <Button variant={reached && onNext ? 'inverse-ghost' : 'inverse'} size="sm" onClick={onReturn}>
          <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
          Back to the tutorial
        </Button>
        {reached && onNext && (
          <Button variant="inverse" size="sm" onClick={onNext}>
            Next step
            <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
          </Button>
        )}
      </div>
    </div>
  );
}

// A row like the Agenda's (see SortableHabitItem): its ring logs it, holding it logs it, swiping it to
// the left skips it, and a tap on the rest of it opens its page. `rowRef` is the element a row
// leaving the list animates (see zoomAway).
export function AgendaRow({ habit, row, days, now, rowRef, onRing, onHold, onSkip, onOpen }: {
  habit: DemoHabit;
  row: RowState;
  days: Days;
  now: number;
  rowRef: (el: HTMLDivElement | null) => void;
  onRing: () => void;
  onHold: () => void;
  onSkip: () => unknown;
  onOpen: () => void;
}) {
  const blue = !!habit.habits;
  const labels = skipLabels(habit.cadence);
  const label = ringLabel(habit);

  const swipe: RowSwipe | undefined = labels ? {
    label: `${labels.skip}: ${habit.name}`,
    reveal: (
      <>
        <SkipIcon postpones={labels.postpones} className="w-5 h-5" />
        <span className="text-sm font-semibold">{labels.skip}</span>
      </>
    ),
    onCommit: onSkip,
  } : undefined;

  return (
    <div ref={rowRef} className="relative bg-surface">
      <RowGesture onCommit={onHold} label={label} tone={blue ? 'category' : 'accent'} hiddenButton={false} swipe={swipe}>
        <div className="flex items-stretch bg-surface hover:bg-surface-subtle transition-colors group/row relative">
          <div className={`flex-1 flex items-center py-3 gap-4 sm:gap-5 ${PANE_INSET} min-w-0`}>
            <LogRing status={{ done: row.entries.length, needed: habit.needed, period: habit.period, dueInDays: null }} label={label} onClick={onRing} color={blue ? 'blue' : 'emerald'} />
            {/* Where the Agenda's row links to its page, stretched over the row (its ::after) */}
            <button
              type="button"
              onClick={onOpen}
              className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-6 min-w-0 w-full justify-between text-left after:absolute after:inset-0 focus-visible:outline-none"
            >
              <RowText habit={habit} days={days} />
              <RowCalendar habit={habit} row={row} days={days} now={now} />
            </button>
          </div>
        </div>
      </RowGesture>
    </div>
  );
}

// A row like the Habits page's: its health where the Agenda has a ring, and a tap opens its page
export function HabitsRow({ habit, row, days, now, onOpen }: { habit: DemoHabit; row: RowState; days: Days; now: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full flex items-center py-3 gap-4 sm:gap-5 ${PANE_INSET} text-left bg-surface hover:bg-surface-subtle transition-colors group/row`}
    >
      <HealthMark consistency={habit.health} />
      <div className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-6 min-w-0 justify-between">
        <RowText habit={habit} days={days} />
        <RowCalendar habit={habit} row={row} days={days} now={now} />
      </div>
    </button>
  );
}

function RowText({ habit, days }: { habit: DemoHabit; days: Days }) {
  const blue = !!habit.habits;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        {blue && <Icon name={habit.filed.icon} className="w-4 h-4 shrink-0 text-category-ink" />}
        <h3 className={`text-lg font-semibold text-ink truncate transition-colors ${blue ? 'group-hover/row:text-category-ink-strong' : 'group-hover/row:text-accent-ink'}`}>{habit.name}</h3>
        {habit.form && <ClipboardList className="w-4 h-4 text-ink-subtle shrink-0" aria-label="Has a form" />}
      </div>
      <CadenceLabel cadence={habit.cadence} weekStartsOn={days.weekStartsOn} />
    </div>
  );
}

function RowCalendar({ habit, row, days, now }: { habit: DemoHabit; row: RowState; days: Days; now: number }) {
  return (
    <div className="shrink-0 opacity-80 group-hover/row:opacity-100 transition-opacity pointer-events-none">
      <ActivityCalendar
        dates={datesOf(habit, row, now)}
        weeks={4}
        size="xs"
        emptyColor="bg-surface-strong/70"
        futureColor="bg-transparent"
        cadence={habit.cadence}
        color={habit.habits ? 'blue' : 'emerald'}
        since={new Date(now - 60 * DAY_MS)}
        timeZone={days.timeZone}
        bedtime={days.bedtime}
        weekStartsOn={days.weekStartsOn}
      />
    </div>
  );
}

// A habit's page, or a category's, as the app has it (see LogClient and the log page): its health
// with its category, cadence and skipping it, the Log Habit button, then its activity, and its
// entries (a category's habits). Shown in place of the tutorial's step, with its `bar` (see
// TutorialBar) pinned under the header.
export function DemoPage({ habit, row, days, now, bar, onBack, onLog, onSkip, onUnskip, onPlant, onNote }: {
  habit: DemoHabit;
  row: RowState;
  days: Days;
  now: number;
  bar: ReactNode;
  onBack: () => void;
  onLog: () => void;
  onSkip: () => void;
  onUnskip: () => void;
  onPlant: () => void;
  // Says something that the tutorial doesn't otherwise check, e.g. changing the cadence
  onNote: (say: string) => void;
}) {
  const category = !!habit.habits;
  const labels = skipLabels(habit.cadence);
  const due = isDue(habit, row);

  // Newest first: today's, then its history
  const entries = [
    ...row.entries.map(entry => ({ key: `today-${entry.key}`, at: now, values: entry.values })).reverse(),
    ...habit.history.flatMap(daysAgo => Array.from({ length: habit.perDay ?? 1 }, (_, i) => ({
      key: `${daysAgo}-${i}`,
      at: now - daysAgo * DAY_MS - i * 90 * 60 * 1000,
      values: habit.pastValues?.(daysAgo),
    }))),
  ].slice(0, 5);

  return (
    <PanePage header={<>
      <PageHeader
        title={<span className="truncate">{habit.name}</span>}
        onBack={onBack}
        actions={
          <IconButton edge="right" title="More options" onClick={() => onNote('That menu has editing, sharing and automation. Nothing here changes in the tutorial.')}>
            <MoreVertical className="w-6 h-6" />
          </IconButton>
        }
      />
      {bar}
    </>}>

      <div className={`${PANE_INSET} py-4 space-y-6`}>
        <HealthHeader
          consistency={habit.health}
          noun={category ? 'Category' : 'Habit'}
          onOpenTip={onPlant}
          top={category ? undefined : (
            <span className={`${PILL} bg-category-soft border-category-line text-category-ink-strong`}>
              <Icon name={habit.filed.icon} className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-[14rem]">{habit.filed.name}</span>
            </span>
          )}
          bottom={
            <>
              <CadenceQuickEdit
                cadence={habit.cadence}
                weekStartsOn={days.weekStartsOn}
                onSave={async () => onNote(`That would change how often ${habit.name} is meant to be done. Nothing's saved in the tutorial.`)}
              />
              {labels && (due || row.skipped) && (
                row.skipped ? (
                  <button type="button" onClick={onUnskip} className={`${PILL} bg-surface-subtle border-line-subtle text-ink-muted hover:bg-surface-muted`}>
                    <SkipIcon postpones={labels.postpones} className="w-4 h-4" />
                    {labels.skipped}
                    <span className="text-ink-secondary">· Undo</span>
                  </button>
                ) : (
                  <button type="button" onClick={onSkip} className={`${PILL} bg-surface border-line text-ink-secondary hover:bg-surface-subtle`}>
                    <SkipIcon postpones={labels.postpones} className="w-4 h-4" />
                    {labels.skip}
                  </button>
                )
              )}
            </>
          }
        />

        <Button size="xl" onClick={onLog} className="w-full">
          <LogButtonIcon hasForm={!!habit.form} busy={false} size="lg" />
          Log Habit
        </Button>
      </div>

      <section>
        <PaneHeading>Activity</PaneHeading>
        <div className={`${PANE_SURFACE} ${PANE_INSET} py-4 overflow-x-auto`}>
          <div className="flex w-full justify-center-safe">
            <ActivityCalendar
              dates={datesOf(habit, row, now)}
              weeks={13}
              size="md"
              cadence={habit.cadence}
              color={category ? 'blue' : 'emerald'}
              since={new Date(now - 120 * DAY_MS)}
              timeZone={days.timeZone}
              bedtime={days.bedtime}
              weekStartsOn={days.weekStartsOn}
            />
          </div>
        </div>
      </section>

      {category ? (
        <PaneSection title="Habits">
          {habit.habits!.map(h => (
            <div key={h.id} className={`${PANE_INSET} py-3 flex items-center gap-4`}>
              <HealthMark consistency={h.health} />
              <RowText habit={h} days={days} />
            </div>
          ))}
        </PaneSection>
      ) : (
        <PaneSection title="Entries">
          {entries.map(entry => {
            const lines = valueLines(habit.form, entry.values);
            return (
              <div key={entry.key} className={`flex items-start gap-4 ${PANE_INSET} py-3`}>
                <div className="w-30 shrink-0">
                  <div className="inline-flex flex-col text-ink whitespace-nowrap">
                    <span className="font-medium">{new Date(entry.at).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: days.timeZone })}</span>
                    <span className="text-sm text-ink-muted text-right">{new Date(entry.at).toLocaleTimeString('en-US', { timeStyle: 'short', timeZone: days.timeZone })}</span>
                  </div>
                </div>
                <div className="flex-1 text-ink-secondary min-w-0">
                  {lines.length > 0
                    ? <div className="space-y-1">{lines.map(line => <div key={line} className="text-sm break-words">{line}</div>)}</div>
                    : <span className="text-ink-subtle italic text-sm">Completed</span>}
                </div>
              </div>
            );
          })}
        </PaneSection>
      )}
    </PanePage>
  );
}

// A habit's entry form, sliding up from the bottom (see LogEntrySheet): its fields, and Log Habit
export function DemoLogSheet({ habit, form, values, onChange, onLog, onClose }: {
  habit: DemoHabit;
  form: DemoForm;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onLog: (values: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  return createPortal(
    <BottomSheet title={habit.name} ariaLabel={`Log ${habit.name}`} onClose={onClose}>
      <div className="rjsf-custom">
        <Form
          schema={{ type: 'object', title: '', required: form.required, properties: form.properties as never }}
          uiSchema={habitFormUiSchema(form.properties)}
          widgets={HABIT_FORM_WIDGETS}
          validator={validator}
          formData={values}
          onChange={e => onChange(e.formData)}
          onSubmit={e => onLog(e.formData ?? {})}
          noHtml5Validate
          showErrorList={false}
          className="rjsf space-y-6"
        >
          <Button type="submit" size="xl" className="w-full">
            <QuillIconWavy className="w-6 h-6" strokeWidth={2.5} />
            Log Habit
          </Button>
        </Form>
      </div>
    </BottomSheet>,
    document.body,
  );
}

// A category's habits to pick one to log (see CategoryLogDialog): a habit with a form shows a
// clipboard, and picking it opens its form
export function DemoPicker({ category, onPick, onClose }: { category: DemoHabit; onPick: (habit: DemoHabit) => void; onClose: () => void }) {
  return createPortal(
    <Dialog label={`Log a habit in ${category.name}`} onClose={onClose}>
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <QuillIconWavy className="w-5 h-5 shrink-0 text-category-ink" strokeWidth={2.5} />
          <h2 className="flex-1 min-w-0 text-lg font-bold text-ink truncate">Log {category.name}</h2>
          <IconButton onClick={onClose} edge="right" title="Close" aria-label="Close">
            <X className="w-5 h-5" />
          </IconButton>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Habits">
          {category.habits?.map(habit => (
            <li key={habit.id}>
              <button
                type="button"
                onClick={() => onPick(habit)}
                title={habit.form ? `Log ${habit.name} (opens a form)` : `Log ${habit.name}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface border border-line text-ink font-medium hover:bg-surface-subtle hover:border-line-strong transition-colors"
              >
                <span className="truncate max-w-[14rem]">{habit.name}</span>
                {habit.form && <ClipboardList className="w-4 h-4 shrink-0 text-ink-subtle" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>,
    document.body,
  );
}
