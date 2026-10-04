import type { ReactNode } from 'react';
import { BELOW_HEADER } from '@/components/PageHeader';

// Pages are the body's stone background, with their lists on white running the full width of the
// screen (rather than in cards), with only the lines between rows. Anything that isn't a list (a
// line of text, a button, chips, an empty state) sits on the stone, as does whatever space is left
// below. Agenda (src/app/page.tsx) is the reference.

// For anything that spans the screen: pads it so its contents sit in the page's centered column,
// lined up with the rows' (see pane-inset in globals.css)
export const PANE_INSET = 'pane-inset';

// The white a section's content sits on, for a section built by hand around a PaneHeading
export const PANE_SURFACE = 'bg-white';

// The column a page's content lines up in, by `width`
const PANE_WIDTHS = {
  '3xl': '[--pane-width:48rem]',
  '4xl': '[--pane-width:56rem]',
};

// The page itself: its sticky header, then its sections, each spanning the screen with its contents
// in a centered column (PANE_INSET). Sections follow each other directly, their headings keeping them
// apart; anything else on the page brings its own vertical padding.
export function PanePage({ header, width = '4xl', children }: { header: ReactNode; width?: keyof typeof PANE_WIDTHS; children: ReactNode }) {
  return (
    <main className={`flex-1 pb-8 bg-stone-50 font-sans ${PANE_WIDTHS[width]}`}>
      {header}
      {children}
    </main>
  );
}

// A small uppercase heading over a section, with an optional control at its right end, on the stone
// background. It pins under the page header while its section scrolls by, until the next section's
// heading takes its place.
export function PaneHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`sticky ${BELOW_HEADER} z-20 ${PANE_INSET} py-2 min-h-9 flex items-center justify-between gap-4 bg-stone-50`}>
      <h2 className="flex items-center gap-2 min-w-0 text-xs font-semibold uppercase tracking-wider text-stone-500">{children}</h2>
      {action}
    </div>
  );
}

// A titled group of rows on white, divided by hairlines. With `empty` set, that text is shown on the
// stone instead, for a section with nothing in it.
export function PaneSection({ title, action, empty, children }: { title: ReactNode; action?: ReactNode; empty?: ReactNode; children?: ReactNode }) {
  return (
    <section>
      <PaneHeading action={action}>{title}</PaneHeading>
      {empty
        ? <div className={`${PANE_INSET} py-3 text-stone-500`}>{empty}</div>
        : <div className={`${PANE_SURFACE} divide-y divide-stone-100`}>{children}</div>}
    </section>
  );
}
