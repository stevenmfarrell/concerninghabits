'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';
import { ToastCard } from '@/components/LoggedToast';
import { SkipIcon } from '@/components/logging/skipping';
import { swipeAway, zoomAway, type Leaving } from '@/components/logging/zoomAway';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PaneHeading, PanePage, PaneSection } from '@/components/Pane';
import QuillIconWavy from '@/components/QuillIconWavy';
import SpeakOrType, { type SpeakOrTypeStatus } from '@/components/SpeakOrType';
import { Button, LinkButton } from '@/components/ui/Button';
import { skipLabels } from '@/lib/cadence';
import { AgendaRow, Goal, Said, TutorialBar, DemoLogSheet, DemoPage, DemoPicker, HabitsRow } from './DemoParts';
import { isDue, valueLines, type Action, type DemoEntry, type DemoHabit, type Days, type How, type Rows, type Verdict } from './demo';
import { STEPS, verdictFor, type Step } from './steps';
import { TUTORIAL_QUILL_SLOT } from '@/components/BottomNav';

// The tutorial: a few steps, each a short explanation and a goal to reach on made-up habits built
// from the app's own pieces (the Agenda's rows and their gestures, a habit's page, its entry form, a
// category's picker, the quill), so what's learned here works the same in the app. Nothing is
// saved. Whatever's done is checked against the step's goal (see steps), and logs and skips come
// with the same notice and Undo as in the app, to take a wrong one back.

// Looks for the quill's slot again once the nav has drawn it, as it may not have yet when this page
// is opened from another (see quillSlot)
function lookAgainNextFrame(onChange: () => void) {
  const frame = requestAnimationFrame(onChange);
  return () => cancelAnimationFrame(frame);
}

// How long the quill "works" on what it's told before logging it, as the AI would
const QUILL_DELAY_MS = 900;

// Words that point the quill at one of the made-up habits
const QUILL_WORDS: [RegExp, string][] = [
  [/vitamin|pill|supplement/i, 'vitamins'],
  [/water|drank|drink|glass/i, 'water'],
  [/stretch/i, 'stretch'],
  [/\b(ran|run|jog)/i, 'run'],
  [/\bread|book/i, 'read'],
];

const QUILL_EXAMPLES = ['Took my vitamins', 'Drank a glass of water', 'I want to start journaling'];

// A form that's open: the habit it's for, the row it's logged to (a category's, for one picked
// from its picker), and how it was opened
interface OpenForm {
  rowId: string;
  habit: DemoHabit;
  values: Record<string, unknown>;
  how: How;
}

function initialRows(step: Step): Rows {
  return Object.fromEntries(step.rows.map(habit => [habit.id, {
    entries: Array.from({ length: habit.startDone ?? 0 }, (_, i) => ({ key: -1 - i })),
    skipped: false,
  }]));
}

export default function Tutorial({ days, now }: { days: Days; now: number }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const last = stepIndex === STEPS.length - 1;

  // Each entry's key, to tell them apart for an Undo (those a step starts with count down from -1)
  const keys = useRef(0);
  const nextKey = () => ++keys.current;

  const [rows, setRows] = useState<Rows>(() => initialRows(STEPS[0]));
  // Kept alongside, for a toast's Undo, which can come after later changes
  const rowsRef = useRef(rows);
  const [reached, setReached] = useState(false);
  const reachedRef = useRef(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  // Whether anything's been done, so there's something to start over from
  const [changed, setChanged] = useState(false);
  // Bumped on every new step or start over, so an Undo from before it does nothing, and the rows
  // are drawn afresh
  const session = useRef(0);
  const [round, setRound] = useState(0);

  // The habit whose page is open in place of the step, its form, or its category's picker
  const [pageId, setPageId] = useState<string | null>(null);
  const [form, setForm] = useState<OpenForm | null>(null);
  const [picker, setPicker] = useState<{ rowId: string; how: How } | null>(null);

  // The rows on their way out of the list, kept until they've gone (see zoomAway)
  const rowEls = useRef<Record<string, HTMLDivElement | null>>({});
  const leavingRef = useRef<Record<string, Leaving>>({});
  const [leaving, setLeaving] = useState<string[]>([]);

  const [quillStatus, setQuillStatus] = useState<SpeakOrTypeStatus>(null);
  const quillTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The bottom nav's middle, where the quill is in the app, which this page leaves for its own (see
  // BottomNav). Nothing to find on the server.
  const quillSlot = useSyncExternalStore(lookAgainNextFrame, () => document.getElementById(TUTORIAL_QUILL_SLOT), () => null);

  const habitById = (id: string) => step.rows.find(h => h.id === id)!;

  // Records what was done to the rows, and what the step makes of it
  const act = (action: Action, next: Rows = rowsRef.current) => {
    rowsRef.current = next;
    setRows(next);
    const said = verdictFor(step, action, next, reachedRef.current);
    if (said.tone === 'met') {
      reachedRef.current = true;
      setReached(true);
    }
    setVerdict(said);
    if (action.kind !== 'open' && action.kind !== 'plant') setChanged(true);
  };

  // Sends a row that's no longer due out of the list, as the Agenda does
  const sendAway = (id: string, how: 'zoom' | 'swipe') => {
    const el = rowEls.current[id];
    const away = how === 'zoom' ? zoomAway(el) : swipeAway(el);
    if (!away) return undefined;
    leavingRef.current[id] = away;
    setLeaving(ids => [...ids, id]);
    const gone = () => {
      if (leavingRef.current[id] !== away) return;
      delete leavingRef.current[id];
      setLeaving(ids => ids.filter(other => other !== id));
    };
    away.finished.then(gone, gone);
    return away.finished;
  };

  // Brings back a row that's leaving, for an Undo while it's still going
  const stopLeaving = (id: string) => {
    leavingRef.current[id]?.cancel();
    delete leavingRef.current[id];
    setLeaving(ids => ids.filter(other => other !== id));
  };

  const log = (habit: DemoHabit, how: How, extra: { picked?: DemoHabit; values?: Record<string, unknown>; said?: string } = {}) => {
    const before = rowsRef.current[habit.id];
    const entry: DemoEntry = { key: nextKey(), values: extra.values, picked: extra.picked?.name };
    const row = { ...before, entries: [...before.entries, entry] };
    const next = { ...rowsRef.current, [habit.id]: row };
    if (isDue(habit, before) && !isDue(habit, row)) sendAway(habit.id, 'zoom');
    act({ kind: 'log', habit, how, picked: extra.picked?.name, values: extra.values }, next);

    const logged = extra.picked ?? habit;
    const at = session.current;
    toast.custom(t => (
      <ToastCard
        t={t}
        icon={<Check className="w-5 h-5" strokeWidth={3} />}
        iconClassName="bg-accent text-on-accent"
        title={`${logged.name} logged`}
        detail={extra.said ? `From “${extra.said}”` : undefined}
        values={valueLines(logged.form, extra.values)}
        onUndo={() => {
          toast.dismiss(t.id);
          if (session.current !== at) return;
          undoLog(habit, entry.key, logged, extra.values);
        }}
      />
    ), { duration: extra.said ? 10000 : 6000 });
  };

  // Takes an entry back, and for one from a form, opens the form again with its values to fix
  const undoLog = (habit: DemoHabit, key: number, logged: DemoHabit, values: Record<string, unknown> | undefined) => {
    stopLeaving(habit.id);
    const before = rowsRef.current[habit.id];
    act({ kind: 'undo', habit, skip: false }, { ...rowsRef.current, [habit.id]: { ...before, entries: before.entries.filter(e => e.key !== key) } });
    if (logged.form && values) {
      setForm({ rowId: habit.id, habit: logged, values, how: 'ring' });
      toast.success('Entry undone. Edit it and log again.');
    } else {
      toast.success('Entry undone.');
    }
  };

  const skip = (habit: DemoHabit) => {
    const labels = skipLabels(habit.cadence);
    const away = sendAway(habit.id, 'swipe');
    act({ kind: 'skip', habit }, { ...rowsRef.current, [habit.id]: { ...rowsRef.current[habit.id], skipped: true } });
    const at = session.current;
    toast.custom(t => (
      <ToastCard
        t={t}
        icon={<SkipIcon postpones={labels?.postpones ?? false} className="w-4 h-4" />}
        iconClassName="bg-on-inverse/15 text-on-inverse"
        title={habit.name}
        detail={labels?.skipped}
        onUndo={() => {
          toast.dismiss(t.id);
          if (session.current !== at) return;
          unskip(habit);
          toast.success(labels?.postpones ? 'Postponement undone.' : 'Skip undone.');
        }}
      />
    ), { duration: 6000 });
    return away;
  };

  const unskip = (habit: DemoHabit) => {
    stopLeaving(habit.id);
    act({ kind: 'undo', habit, skip: true }, { ...rowsRef.current, [habit.id]: { ...rowsRef.current[habit.id], skipped: false } });
  };

  // What logging a habit does, from wherever: a category opens its picker, a habit with a form opens
  // the form, and any other habit is logged on the spot
  const start = (habit: DemoHabit, how: How) => {
    if (habit.habits) setPicker({ rowId: habit.id, how });
    else if (habit.form) setForm({ rowId: habit.id, habit, values: {}, how });
    else log(habit, how);
  };

  const pick = (habit: DemoHabit) => {
    if (!picker) return;
    const category = habitById(picker.rowId);
    setPicker(null);
    if (habit.form) setForm({ rowId: category.id, habit, values: {}, how: picker.how });
    else log(category, picker.how, { picked: habit });
  };

  const closeForm = () => {
    if (!form) return;
    setForm(null);
    // One picked from a category's picker goes back to the picker, as in the app
    if (form.rowId !== form.habit.id) setPicker({ rowId: form.rowId, how: form.how });
    else act({ kind: 'cancel', habit: form.habit });
  };

  const submitForm = (values: Record<string, unknown>) => {
    if (!form) return;
    setForm(null);
    const row = habitById(form.rowId);
    log(row, form.how, { values, picked: row.id === form.habit.id ? undefined : form.habit });
  };

  const open = (habit: DemoHabit) => {
    setPageId(habit.id);
    act({ kind: 'open', habit });
    window.scrollTo({ top: 0 });
  };

  // Back to the step from a habit's page, where what was said (e.g. "tap Back to the tutorial") is
  // done with: short of the goal, it's how to reach it instead
  const close = () => {
    setPageId(null);
    if (!reachedRef.current) setVerdict({ tone: 'progress', say: step.hint });
    window.scrollTo({ top: 0 });
  };

  const tellQuill = (input: string) => {
    setQuillStatus({ input, message: 'Finding the habit it goes with...' });
    const at = session.current;
    quillTimer.current = setTimeout(() => {
      if (session.current !== at) return;
      setQuillStatus(null);
      const id = QUILL_WORDS.find(([words]) => words.test(input))?.[1];
      const habit = step.rows.find(h => h.id === id);
      // Anything matched to a habit is logged, as by the quill in the app
      if (habit) log(habit, 'quill', { said: input });
      else act({ kind: 'unmatched', input });
    }, QUILL_DELAY_MS);
  };

  // Puts the step back as it started: its rows, its goal, and anything open
  const reset = (to: Step) => {
    session.current++;
    setRound(r => r + 1);
    clearTimeout(quillTimer.current);
    toast.dismiss();
    Object.values(leavingRef.current).forEach(away => away.cancel());
    leavingRef.current = {};
    const fresh = initialRows(to);
    rowsRef.current = fresh;
    setRows(fresh);
    reachedRef.current = false;
    setReached(false);
    setVerdict(null);
    setChanged(false);
    setPageId(null);
    setForm(null);
    setPicker(null);
    setLeaving([]);
    setQuillStatus(null);
  };

  const goTo = (index: number) => {
    setStepIndex(index);
    reset(STEPS[index]);
    window.scrollTo({ top: 0 });
  };

  const page = pageId ? habitById(pageId) : null;

  const overlays = (
    <>
      {form?.habit.form && (
        <DemoLogSheet
          habit={form.habit}
          form={form.habit.form}
          values={form.values}
          onChange={values => setForm(f => f && { ...f, values })}
          onLog={submitForm}
          onClose={closeForm}
        />
      )}
      {picker && (
        <DemoPicker
          category={habitById(picker.rowId)}
          onPick={pick}
          onClose={() => {
            setPicker(null);
            act({ kind: 'cancel', habit: habitById(picker.rowId) });
          }}
        />
      )}
    </>
  );

  if (page) {
    return (
      <>
        <DemoPage
          key={`${round}-${page.id}`}
          habit={page}
          row={rows[page.id]}
          days={days}
          now={now}
          bar={
            <TutorialBar
              step={stepIndex + 1}
              of={STEPS.length}
              goal={step.goal}
              reached={reached}
              verdict={verdict}
              onReturn={close}
              onNext={last ? undefined : () => goTo(stepIndex + 1)}
            />
          }
          onBack={close}
          onLog={() => start(page, 'page')}
          onSkip={() => skip(page)}
          onUnskip={() => unskip(page)}
          onPlant={() => act({ kind: 'plant', habit: page })}
          onNote={say => setVerdict({ tone: 'progress', say })}
        />
        {overlays}
      </>
    );
  }

  const shown = step.rows.filter(h => isDue(h, rows[h.id]) || leaving.includes(h.id));
  const recent = step.view === 'agenda' ? step.rows.filter(h => !isDue(h, rows[h.id]) && !leaving.includes(h.id)) : [];

  return (
    <PanePage width="3xl" header={<PageHeader title="Tutorial" />}>
      <div className={`${PANE_INSET} pt-5 pb-4 space-y-3`}>
        <div className="flex gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-accent' : 'bg-surface-strong'}`} />
          ))}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Step {stepIndex + 1} of {STEPS.length}</p>
        <h2 className="text-2xl font-bold text-ink">{step.title}</h2>
        <div className="text-ink-secondary space-y-2 leading-relaxed">{step.body}</div>
        <div className="pt-2"><Goal goal={step.goal} reached={reached} /></div>
      </div>

      {/* In the bottom nav, as in the app, though it only does anything on its own step */}
      {quillSlot && createPortal(
        <SpeakOrType
          icon={<QuillIconWavy className="w-7 h-7" strokeWidth={2.5} />}
          ariaLabel={{ speak: 'Say what you did', type: 'Type what you did' }}
          disabled={!step.quill}
          prompt={{
            listening: 'Listening...',
            typing: 'What do you want to log?',
            hint: "Tell me something you did, or a habit you'd like to start.",
          }}
          examples={QUILL_EXAMPLES}
          status={quillStatus}
          onInput={tellQuill}
        />,
        quillSlot,
      )}

      {step.view === 'agenda' ? (
        <PaneSection title="Due now" empty={shown.length === 0 && 'Nothing due right now.'}>
          {shown.map(habit => (
            <AgendaRow
              key={`${round}-${habit.id}`}
              habit={habit}
              row={rows[habit.id]}
              days={days}
              now={now}
              rowRef={el => { rowEls.current[habit.id] = el; }}
              onRing={() => start(habit, 'ring')}
              onHold={() => start(habit, 'hold')}
              onSkip={() => skip(habit)}
              onOpen={() => open(habit)}
            />
          ))}
        </PaneSection>
      ) : (
        <PaneSection title="All habits">
          {step.rows.map(habit => (
            <HabitsRow key={habit.id} habit={habit} row={rows[habit.id]} days={days} now={now} onOpen={() => open(habit)} />
          ))}
        </PaneSection>
      )}

      <Said verdict={verdict} className={`${PANE_INSET} pt-4`} />

      {recent.length > 0 && (
        <section>
          <PaneHeading>Recently logged</PaneHeading>
          <ul className={`${PANE_INSET} py-3 flex flex-wrap gap-2`} aria-label="Recently Logged">
            {recent.map(habit => {
              const skipped = rows[habit.id].skipped;
              const blue = !!habit.habits;
              return (
                <li key={habit.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border ${skipped ? 'border-line' : blue ? 'border-category-line' : 'border-accent-line-strong'} text-sm font-medium text-ink-secondary`}>
                  {skipped
                    ? <SkipIcon postpones={skipLabels(habit.cadence)?.postpones ?? false} className="w-3.5 h-3.5 shrink-0 text-ink-muted" />
                    : <Check className={`w-3.5 h-3.5 shrink-0 ${blue ? 'text-category-ink' : 'text-accent-ink'}`} strokeWidth={3} />}
                  <span className="truncate max-w-[14rem]">{habit.name}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className={`${PANE_INSET} pt-6 pb-6 flex flex-wrap items-center justify-between gap-3`}>
        <Button variant="ghost" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0}>Back</Button>
        <div className="flex flex-wrap justify-end gap-3">
          {changed && <Button variant="outline" onClick={() => reset(step)}>Start over</Button>}
          {last ? (
            <>
              <LinkButton href="/create" variant="outline">Create a habit</LinkButton>
              <LinkButton href="/">Go to Agenda</LinkButton>
            </>
          ) : reached ? (
            <Button onClick={() => goTo(stepIndex + 1)}>Next</Button>
          ) : (
            <Button variant="outline" onClick={() => goTo(stepIndex + 1)}>Skip step</Button>
          )}
        </div>
      </div>
      {last && <p className={`${PANE_INSET} pb-4 text-sm text-ink-muted`}>You can come back to this from Settings.</p>}
      {overlays}
    </PanePage>
  );
}
