import type { ReactNode } from 'react';
import { BELOW_HEADER } from '@/components/PageHeader';

// Pages are the body's stone background (the canvas), with their lists on white (the surface) running the full width of the
// screen (rather than in cards), with only the lines between rows. Anything that isn't a list (a
// line of text, a button, chips, an empty state) sits on the stone, as does whatever space is left
// below. Agenda (src/app/page.tsx) is the reference.

// For anything that spans the screen: pads it so its contents sit in the page's centered column,
// lined up with the rows' (see pane-inset in globals.css)
export const PANE_INSET = 'pane-inset';

// The white a section's content sits on, for a section built by hand around a PaneHeading, with a
// hairline along its top and bottom so it reads as a block against the stone
export const PANE_SURFACE = 'bg-surface border-y border-line';

// The column a page's content lines up in, by `width`
const PANE_WIDTHS = {
  // e.g. a sign-in form
  'md': '[--pane-width:28rem]',
  '3xl': '[--pane-width:48rem]',
  '4xl': '[--pane-width:56rem]',
};

// The page itself: its sticky header, then its sections, each spanning the screen with its contents
// in a centered column (PANE_INSET). Sections follow each other directly, their headings keeping them
// apart; anything else on the page brings its own vertical padding. A page with no header (e.g.
// signing in) can be `centered` on the screen instead.
export function PanePage({ header, width = '4xl', centered = false, children }: { header?: ReactNode; width?: keyof typeof PANE_WIDTHS; centered?: boolean; children: ReactNode }) {
  return (
    <main className={`flex-1 pb-8 bg-canvas font-sans ${PANE_WIDTHS[width]} ${centered ? 'flex flex-col justify-center py-8' : ''}`}>
      {header}
      {children}
    </main>
  );
}

// A small uppercase heading over a section, with optional controls at its right end, on the stone
// background. It sits well below whatever's above it and close to its own content, so it reads as
// belonging to the section below. It pins under the page header while its section scrolls by, until
// the next section's heading takes its place; the space above it is a separate spacer, which scrolls
// away, so the pinned heading stays slim. Its controls are all 32px tall, so every heading is the same
// height when pinned: SegmentedControl, IconButton size="sm", Button size="xs" (see UI_STANDARDS.md).
// Being sticky, each heading is its own stacking context, so a menu opened from its controls can't
// rise above the headings after it, whatever its z-index: while a control's menu is open (its
// trigger's aria-expanded), the heading lifts above the others, still under the page header.
export function PaneHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <>
      <div className="h-4" aria-hidden="true" />
      <div className={`sticky ${BELOW_HEADER} z-20 has-[[aria-expanded=true]]:z-25 ${PANE_INSET} pt-2 pb-1.5 min-h-9 flex items-end justify-between gap-4 bg-canvas`}>
        <h2 className="flex items-center gap-2 min-w-0 text-xs font-semibold uppercase tracking-wider text-ink-muted">{children}</h2>
        {/* The controls overhang the row's padding, so a heading is as slim with them as without */}
        {action && <div className="shrink-0 -my-1.5 flex items-center gap-2">{action}</div>}
      </div>
    </>
  );
}

// A titled group of rows on white, divided by hairlines. With `empty` set, that text is shown on the
// stone instead, for a section with nothing in it. The two are keyed apart, so the white isn't
// reused for the stone along with anything done to it (e.g. zoomAway fading it out).
export function PaneSection({ title, action, empty, children }: { title: ReactNode; action?: ReactNode; empty?: ReactNode; children?: ReactNode }) {
  return (
    <section>
      <PaneHeading action={action}>{title}</PaneHeading>
      {empty
        ? <div key="empty" className={`${PANE_INSET} py-3 text-ink-muted`}>{empty}</div>
        : <div key="rows" className={`${PANE_SURFACE} divide-y divide-line-subtle`} data-pane-surface>{children}</div>}
    </section>
  );
}

// A form field as a row in a pane's list: its label, an optional line about it, then its control
// (with `id` matching `htmlFor`)
export function PaneField({ label, htmlFor, description, children }: { label: string; htmlFor?: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className={`${PANE_INSET} py-3 space-y-1.5`}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink-secondary">{label}</label>
      {description && <p className="text-sm text-ink-muted">{description}</p>}
      {children}
    </div>
  );
}
