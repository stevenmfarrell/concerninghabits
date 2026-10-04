import PageHeader from '@/components/PageHeader';

// Loading placeholders for the routes' loading.tsx files. Next prefetches these while a link is on
// screen, so a tap shows the next page's outline immediately instead of waiting on the server.

export function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-strong/70 ${className}`} />;
}

// A pane page (see Pane): the sticky header, then placeholder rows running edge to edge. A tab's
// header has its large title and no back button; a drill-in page's (`drillIn`) has a working one.
export function PanePageSkeleton({ rows = 5, width = '4xl', drillIn = false }: { rows?: number; width?: '3xl' | '4xl'; drillIn?: boolean }) {
  return (
    <main className={`flex-1 pb-8 bg-canvas font-sans ${width === '3xl' ? '[--pane-width:48rem]' : '[--pane-width:56rem]'}`}>
      {drillIn
        ? <PageHeader title={<SkeletonBar className="h-6 w-40" />} />
        : <PageHeader title={<SkeletonBar className="h-8 w-36" />} showBack={false} />}
      <div className="mt-13 bg-surface border-y border-line divide-y divide-line-subtle">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 pane-inset">
            <SkeletonBar className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonBar className="h-4 w-1/2" />
              <SkeletonBar className="h-3 w-1/4" />
            </div>
            <SkeletonBar className="h-8 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </main>
  );
}
