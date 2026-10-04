import PageHeader from '@/components/PageHeader';

// Loading placeholders for the routes' loading.tsx files. Next prefetches these while a link is on
// screen, so a tap shows the next page's outline immediately instead of waiting on the server.

export function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-stone-200/70 ${className}`} />;
}

// A white card like the pages' own, holding `rows` placeholder list rows
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 divide-y divide-stone-100">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 px-4 sm:px-6">
          <SkeletonBar className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBar className="h-4 w-1/2" />
            <SkeletonBar className="h-3 w-1/4" />
          </div>
          <SkeletonBar className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// Pages reached by drilling into a record that still use cards: the sticky header (with a working back button) over cards
export function RecordPageSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <main className="flex-1 bg-stone-50 font-sans flex flex-col h-full">
      <PageHeader title={<SkeletonBar className="h-6 w-40" />} />
      <div className="p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">
        {Array.from({ length: cards }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </main>
  );
}

// A pane page (see Pane): the sticky header, then placeholder rows running edge to edge. A tab's
// header has its large title and no back button; a drill-in page's (`drillIn`) has a working one.
export function PanePageSkeleton({ rows = 5, width = '4xl', drillIn = false }: { rows?: number; width?: '3xl' | '4xl'; drillIn?: boolean }) {
  return (
    <main className={`flex-1 pb-8 bg-stone-50 font-sans ${width === '3xl' ? '[--pane-width:48rem]' : '[--pane-width:56rem]'}`}>
      {drillIn
        ? <PageHeader title={<SkeletonBar className="h-6 w-40" />} />
        : <PageHeader title={<SkeletonBar className="h-8 w-36" />} showBack={false} />}
      <div className="mt-13 bg-white border-y border-stone-200 divide-y divide-stone-100">
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
