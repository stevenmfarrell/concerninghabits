import type { ReactNode } from 'react';

// What a page shows when it has nothing to show yet: the faded hobbit hole, a title, a line on
// what to do about it, and optionally a button (e.g. a LinkButton to create something). Shared so
// every page's empty state looks the same.
export default function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="py-16 sm:py-24 px-8 sm:px-12 text-center flex flex-col items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG, nothing for next/image to optimize */}
      <img src="/hobbit-hole.svg" alt="" className="w-64 sm:w-80 max-w-full h-auto opacity-10 mb-8" />
      <h2 className="text-2xl font-semibold text-ink-secondary mb-2">{title}</h2>
      <p className="text-base text-ink-muted max-w-sm">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
