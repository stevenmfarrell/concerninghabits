import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

// A row in a pane's list (see Pane) whose contents fold away under it, with a one-line `summary` of
// them shown under its title, so settings that are rarely changed stay out of the way but their state
// is still in view. Its contents unfold below it as more rows, divided by hairlines.
export default function CollapsibleSection({ title, summary, defaultOpen = false, children }: {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex items-center gap-3 pane-inset py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden select-none hover:bg-surface-subtle transition-colors">
        <ChevronRight className="w-5 h-5 text-ink-subtle shrink-0 transition-transform group-open:rotate-90" />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink">{title}</h3>
          {summary && <p className="text-sm text-ink-muted truncate">{summary}</p>}
        </div>
      </summary>
      <div className="border-t border-line-subtle divide-y divide-line-subtle">{children}</div>
    </details>
  );
}
