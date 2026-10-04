import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

// A card whose contents fold away under its title, with a one-line `summary` of them shown beside
// the title, so settings that are rarely changed stay out of the way but their state is still in view
export default function CollapsibleSection({ title, summary, defaultOpen = false, children }: {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group bg-white rounded-2xl shadow-sm border border-stone-100">
      <summary className="flex items-center gap-3 p-5 sm:px-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none">
        <ChevronRight className="w-5 h-5 text-stone-400 shrink-0 transition-transform group-open:rotate-90" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-stone-800">{title}</h2>
          {summary && <p className="text-sm text-stone-500 truncate">{summary}</p>}
        </div>
      </summary>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6 space-y-4">{children}</div>
    </details>
  );
}
