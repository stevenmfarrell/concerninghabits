import type { ReactNode } from 'react';
import { EXERCISE, GUITAR, COOK, READ, RUN, STRETCH, VITAMINS, WATER, describe, healthInWords, isDone, progressOf, valuesInWords, type Action, type DemoHabit, type Rows, type Verdict } from './demo';

// The tutorial's steps. Each has a goal to reach on its made-up habits, and checks what's done
// against it: saying when it's reached, how far along it is, or, when something else happened, what
// that was and how to get back on track.
export interface Step {
  title: string;
  body: ReactNode;
  goal: string;
  // How to reach the goal, for when something else was done
  hint: string;
  // The Agenda's rows to try it on, or the Habits page's (which open a habit's page, and nothing else)
  view: 'agenda' | 'habits';
  rows: DemoHabit[];
  // The quill above the rows, to say or type what was done
  quill?: boolean;
  // What to say about `action`, given the rows after it and whether the goal was already reached,
  // or nothing for the general description and hint (see verdictFor)
  check: (action: Action, rows: Rows, met: boolean) => Verdict | undefined;
}

const met = (say: string): Verdict => ({ tone: 'met', say });
const progress = (say: string): Verdict => ({ tone: 'progress', say });
const miss = (say: string): Verdict => ({ tone: 'miss', say });

const UNDO = 'Tap Undo on the notice at the bottom to take it back.';

// What to say about an action: the step's own words for it, or else what it did, then, if the goal
// isn't reached yet, how to reach it (and for a log or skip, how to take it back)
export function verdictFor(step: Step, action: Action, rows: Rows, reached: boolean): Verdict {
  const own = step.check(action, rows, reached);
  if (own) return own;
  const said = describe(action, rows);
  if (reached || action.kind === 'undo') return progress(said);
  const undo = action.kind === 'log' || action.kind === 'skip' ? ` ${UNDO}` : '';
  return miss(`${said}${undo} ${step.hint}`);
}

const FIVE_OF_EIGHT: DemoHabit = { ...WATER, startDone: 5 };

export const STEPS: Step[] = [
  {
    title: 'Open a habit',
    body: (
      <p>The Agenda lists what&apos;s due, a row for each habit: a ring to log it, its name over how often it&apos;s meant to be done, and its last four weeks, a square a day. Tapping the rest of the row opens the habit&apos;s page.</p>
    ),
    goal: "Open Run's page.",
    hint: "To open a habit, tap its name, not the ring.",
    view: 'agenda',
    rows: [WATER, RUN],
    check: action => {
      if (action.kind !== 'open') return undefined;
      return action.habit.id === RUN.id
        ? met("This is Run's page: its health, category and cadence, a Log Habit button, then its activity and entries. Tap Next step to go on.")
        : miss(`This is ${action.habit.name}'s page, not Run's. Tap Back to the tutorial, then tap Run.`);
    },
  },
  {
    title: 'Tap the ring to log',
    body: (
      <p>The ring at the start of a row logs the habit, like ticking a box. A habit you do several times a day counts up, and is done once the ring is full.</p>
    ),
    goal: "Finish today's Water: tap its ring until all 8 glasses are logged.",
    hint: "Tap the ring at the start of Water's row.",
    view: 'agenda',
    rows: [FIVE_OF_EIGHT, STRETCH],
    check: (action, rows, reached) => {
      if (action.kind === 'log' && action.habit.id === WATER.id) {
        const row = rows[WATER.id];
        if (isDone(WATER, row)) return met("8 of 8: Water's done for today, so it left Due Now. Every log comes with an Undo, on the notice at the bottom.");
        const left = WATER.needed - row.entries.length;
        const aside = action.how === 'hold' ? ' Holding the row logs too, which is next.' : action.how === 'page' ? " Its page's Log Habit button logs too." : '';
        return progress(`${row.entries.length} of 8 today. ${left} more to go.${aside}`);
      }
      if (action.kind === 'log' && !reached) return miss(`That logged Stretch, not Water. ${UNDO} Then tap Water's ring.`);
      return undefined;
    },
  },
  {
    title: 'Log one with a form',
    body: (
      <p>A clipboard after a habit&apos;s name means it has a form, like a run&apos;s distance and time. Its ring opens the form to fill in, and what you log shows up in the habit&apos;s entries and charts.</p>
    ),
    goal: "Log today's run: 3 miles in 30 minutes.",
    hint: "Tap Run's ring to open its form.",
    view: 'agenda',
    rows: [RUN, READ],
    check: action => {
      if (action.kind !== 'log' || action.habit.id !== RUN.id) return undefined;
      const { distance, time } = action.values ?? {};
      if (distance === 3 && typeof time === 'number' && Math.abs(time - 30) < 0.01) {
        return met("Run's logged with its distance and time, and it's done until it's due again in 3 days.");
      }
      return miss(`That logged ${valuesInWords(RUN.form, action.values) || 'a run'}, not 3 miles in 30 minutes. Tap Undo on the notice at the bottom, and the form comes back to fix.`);
    },
  },
  {
    title: 'Press and hold to log',
    body: (
      <p>Pressing and holding a row anywhere logs it too, as a tint fills it: the quickest way down a list. A habit with a form opens it, the same as its ring would.</p>
    ),
    goal: 'Log Stretch by pressing and holding its row until the tint fills it.',
    hint: "Press anywhere on Stretch's row and keep holding until it fills. With a mouse, click and hold.",
    view: 'agenda',
    rows: [STRETCH, VITAMINS],
    check: (action, _rows, reached) => {
      if (reached) return undefined;
      if (action.kind === 'log' && action.habit.id === STRETCH.id) {
        return action.how === 'hold'
          ? met("That's the hold. Stretch is done for today, so it left Due Now, and waits under Recently Logged.")
          : miss(`That logged Stretch with ${action.how === 'ring' ? 'a tap on its ring' : 'its page'}, which works, but this step is about holding. ${UNDO} Then hold the row instead.`);
      }
      if (action.kind === 'log' && action.how === 'hold') return miss(`Right gesture, but that was Vitamins. ${UNDO} Then hold Stretch.`);
      if (action.kind === 'open') return miss(`A quick tap opens the habit's page. Tap Back to the tutorial, and this time keep holding until the tint fills the row.`);
      return undefined;
    },
  },
  {
    title: 'Swipe left to skip',
    body: (
      <>
        <p>Sick, traveling, or taking a rest day? Swipe a row to the left to skip it. A skipped day doesn&apos;t count against the habit.</p>
        <p>A habit done every few days is postponed instead, so it&apos;s due again a day later. Going away for a while? Settings → Vacation skips everything until you&apos;re back.</p>
      </>
    ),
    goal: "You're sick today: skip Read by swiping its row to the left.",
    hint: "Swipe Read's row to the left and let go. With a mouse, drag it.",
    view: 'agenda',
    rows: [READ, RUN],
    check: (action, rows, reached) => {
      if (action.kind === 'skip' && action.habit.id === READ.id) {
        return met(`Read's skipped for today, and that doesn't count against it.${rows[RUN.id].skipped ? '' : ' Try swiping Run too, to see a postponement.'}`);
      }
      if (action.kind === 'skip' && action.habit.id === RUN.id && !reached) {
        return miss(`That postponed Run, which is done every few days, so it's due again tomorrow. ${UNDO} Then swipe Read.`);
      }
      if (action.kind === 'log' && action.habit.id === READ.id && !reached) {
        return miss(`That logged Read rather than skipping it. ${UNDO} Then swipe its row to the left.`);
      }
      return undefined;
    },
  },
  {
    title: 'Categories',
    body: (
      <p>A category can have a cadence of its own, like exercising 3 times a week with any of its habits. Its rows are blue, and its ring counts what you&apos;ve done toward it: tap it, or hold the row, and pick which habit you did.</p>
    ),
    goal: 'You went for a swim: log it toward Exercise.',
    hint: "Tap Exercise's ring, then pick Swim.",
    view: 'agenda',
    rows: [EXERCISE],
    check: (action, rows, reached) => {
      if (action.kind !== 'log' || reached) return undefined;
      if (action.picked === '🏊 Swim') return met(`Swim counts toward Exercise: ${progressOf(EXERCISE, rows[EXERCISE.id])}. The category's ring counts any of its habits.`);
      return miss(`That logged ${action.picked ?? 'a habit'} toward Exercise, not a swim. ${UNDO} Then pick Swim.`);
    },
  },
  {
    title: 'Habit health',
    body: (
      <>
        <p>On the Habits page, each habit starts with a plant instead of a ring: how consistently you&apos;ve kept it up lately. The more of it that&apos;s grown, the better.</p>
        <p>It isn&apos;t a streak. A miss dips it a little rather than starting it over, it grows back as you pick the habit up again, and skips and vacations don&apos;t count against it.</p>
      </>
    ),
    goal: 'Find the habit that needs care, open it, and tap the plant on its page to see how it is.',
    hint: 'Look for the amber plant, with only its lowest leaves grown.',
    view: 'habits',
    rows: [WATER, STRETCH, READ, GUITAR, COOK],
    check: (action, _rows, reached) => {
      if (action.kind === 'plant') {
        return action.habit.id === READ.id
          ? met(`${healthInWords(READ)}. Log it a few times and it grows back.`)
          : reached ? progress(`${healthInWords(action.habit)}.`) : miss(`${healthInWords(action.habit)}. Tap Back to the tutorial and look for the amber plant, with only its lowest leaves grown.`);
      }
      if (action.kind === 'open' && !reached) {
        return action.habit.id === READ.id
          ? progress("This is Read's page. Now tap its plant, just below this bar.")
          : miss(`This is ${action.habit.name}'s page, and its plant isn't the amber one. Tap Back to the tutorial and look again.`);
      }
      return undefined;
    },
  },
  {
    title: 'Tell it what you did',
    body: (
      <>
        <p>The quill at the top of the Agenda takes what you did in your own words, like &ldquo;ran 3 miles in 28 minutes&rdquo;, and logs it to the right habit with its form filled in. Describe a habit you&apos;d like to start, and it drafts one for you.</p>
        <p>Speak or type: the arrow beside the quill switches between them. Here it only goes by a few words. In the app, AI reads what you said.</p>
      </>
    ),
    goal: 'Log your vitamins without touching their row: tell the quill you took them.',
    hint: 'Tap the quill above the list, then say or type “took my vitamins”.',
    view: 'agenda',
    rows: [VITAMINS, WATER],
    quill: true,
    check: (action, _rows, reached) => {
      if (reached || action.kind !== 'log') return undefined;
      if (action.habit.id === VITAMINS.id) {
        return action.how === 'quill'
          ? met("Matched to Vitamins and logged, without finding its row. That's handy once you have a long list.")
          : miss(`That logged Vitamins from its row, which works, but this step is about the quill. ${UNDO} Then tell the quill instead.`);
      }
      return action.how === 'quill' ? miss('That logged a glass of Water. The goal is your vitamins: try “took my vitamins”.') : undefined;
    },
  },
];
