import type { ReactNode } from 'react';
import InkArt from './ui/InkArt';

// What a page shows when it has nothing to show yet: a faded sprout, a title, a line on
// what to do about it, and optionally a button (e.g. a LinkButton to create something). Shared so
// every page's empty state looks the same.
export default function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="py-16 sm:py-24 px-8 sm:px-12 text-center flex flex-col items-center justify-center">
      {/* The hobbit hole is kept for the Agenda's Due Now being cleared (see DueNowCleared) */}
      <InkArt src="/plant-icon.svg" aspect={131.56 / 70.62} className="w-28 sm:w-32 opacity-20 mb-6" />
      <h2 className="text-2xl font-semibold text-ink-secondary mb-2">{title}</h2>
      <p className="text-base text-ink-muted max-w-sm">{children}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
