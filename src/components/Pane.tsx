import type { ReactNode } from 'react';

// Pages are one full-width white pane rather than cards on a stone background, so lists run edge
// to edge with only the lines between rows. Agenda (src/app/page.tsx) is the reference.

// Lined up with the rows' contents, which run the full width of the page
export const PANE_INSET = 'px-4 sm:px-6';

// The page itself: its sticky header, then its content in a centered column. The pane reaches down
// under the bottom nav's spacer (5rem, see BottomNav), which would otherwise show the body's stone
// background as a band above the nav.
export function PanePage({ header, width = 'max-w-4xl', children }: { header: ReactNode; width?: string; children: ReactNode }) {
  return (
    <main className="flex-1 pb-24 sm:pb-28 -mb-20 bg-white font-sans">
      {header}
      <div className={`${width} mx-auto pt-4 sm:pt-8 space-y-8`}>{children}</div>
    </main>
  );
}

// A small uppercase heading over a section's rows, with an optional control at its right end
export function PaneHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`${PANE_INSET} pb-2 flex items-center justify-between gap-4`}>
      <h2 className="flex items-center gap-2 min-w-0 text-xs font-semibold uppercase tracking-wider text-stone-500">{children}</h2>
      {action}
    </div>
  );
}

// A titled group of rows, divided by hairlines
export function PaneSection({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <PaneHeading action={action}>{title}</PaneHeading>
      <div className="divide-y divide-stone-100">{children}</div>
    </section>
  );
}
