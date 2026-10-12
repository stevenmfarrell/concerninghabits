import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import BackButton from '@/components/BackButton';
import { IconButton, IconLinkButton } from '@/components/ui/IconButton';

// Where something pinned under the header sticks, e.g. a pane's section headings (see Pane). The
// header has a fixed height so this stays true.
export const BELOW_HEADER = 'top-17 sm:top-19';

interface PageHeaderProps {
  title: ReactNode;
  /** Lighter text after the title, e.g. today's date. Only on the bottom nav's tabs (`showBack={false}`). */
  subtitle?: ReactNode;
  /** Href for the back control. Omit to fall back to browser history (router.back()). */
  backHref?: string;
  /** Instead of navigating, what the back control does, e.g. leaving a view drawn in place of the
   * page (the tutorial's made-up habit pages) */
  onBack?: () => void;
  /** False on the bottom nav's tabs, which have nothing to go back to. Their title is large and
   * left-aligned, where the back control would be, rather than centered. */
  showBack?: boolean;
  /** Right-side slot: an icon button, a menu, or a compact action link. */
  actions?: ReactNode;
  /** Horizontal padding reserved so the centered title (drill-in pages) doesn't collide with back/actions. */
  titleInsetClassName?: string;
}

// Its contents line up with the page's column on a pane page (see pane-inset in globals.css)
export default function PageHeader({ title, subtitle, backHref, onBack, showBack = true, actions, titleInsetClassName = 'px-14' }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-30 h-17 sm:h-19 border-b border-line pane-inset flex items-center justify-between shadow-sm">
      {/* The frosted background is its own layer: a backdrop blur on the header itself would make it
          the containing block for `fixed` descendants, confining a menu's tap-outside-to-close
          overlay to the header */}
      <div className="absolute inset-0 -z-10 bg-surface/80 backdrop-blur-md" />
      {showBack ? (
        <>
          <div className="relative z-10 shrink-0">
            {onBack ? (
              <IconButton onClick={onBack} edge="left" title="Back">
                <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
              </IconButton>
            ) : backHref ? (
              <IconLinkButton href={backHref} edge="left" title="Back">
                <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
              </IconLinkButton>
            ) : (
              <BackButton />
            )}
          </div>

          <h1 className={`absolute inset-0 flex items-center justify-center text-xl sm:text-2xl font-bold text-ink pointer-events-none ${titleInsetClassName}`}>
            <span className="truncate flex items-center gap-2">{title}</span>
          </h1>
        </>
      ) : (
        <h1 className="min-w-0 flex items-baseline gap-2.5 mr-4">
          <span className="truncate text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">{title}</span>
          {subtitle && <span className="shrink-0 text-sm sm:text-base font-semibold uppercase tracking-wider text-ink-subtle">{subtitle}</span>}
        </h1>
      )}

      <div className="relative z-10 shrink-0 flex items-center gap-1">
        {actions}
      </div>
    </div>
  );
}
