import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import BackButton from '@/components/BackButton';
import { IconLinkButton } from '@/components/ui/IconButton';

interface PageHeaderProps {
  title: ReactNode;
  /** Lighter text after the title, e.g. today's date. Only on the bottom nav's tabs (`showBack={false}`). */
  subtitle?: ReactNode;
  /** Href for the back control. Omit to fall back to browser history (router.back()). */
  backHref?: string;
  /** False on the bottom nav's tabs, which have nothing to go back to. Their title is large and
   * left-aligned, where the back control would be, rather than centered. */
  showBack?: boolean;
  /** Right-side slot: an icon button, a menu, or a compact action link. */
  actions?: ReactNode;
  /** Horizontal padding reserved so the centered title (drill-in pages) doesn't collide with back/actions. */
  titleInsetClassName?: string;
}

export default function PageHeader({ title, subtitle, backHref, showBack = true, actions, titleInsetClassName = 'px-14' }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-30 border-b border-stone-200 px-4 py-3 sm:px-8 sm:py-4 flex items-center justify-between shadow-sm">
      {/* The frosted background is its own layer: a backdrop blur on the header itself would make it
          the containing block for `fixed` descendants, confining a menu's tap-outside-to-close
          overlay to the header */}
      <div className="absolute inset-0 -z-10 bg-white/80 backdrop-blur-md" />
      {showBack ? (
        <>
          <div className="relative z-10 shrink-0">
            {backHref ? (
              <IconLinkButton href={backHref} edge="left" title="Back">
                <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
              </IconLinkButton>
            ) : (
              <BackButton />
            )}
          </div>

          <h1 className={`absolute inset-0 flex items-center justify-center text-xl sm:text-2xl font-bold text-stone-900 pointer-events-none ${titleInsetClassName}`}>
            <span className="truncate flex items-center gap-2">{title}</span>
          </h1>
        </>
      ) : (
        <h1 className="min-w-0 flex items-baseline gap-2.5 mr-4">
          <span className="truncate text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">{title}</span>
          {subtitle && <span className="shrink-0 text-sm sm:text-base font-semibold uppercase tracking-wider text-stone-400">{subtitle}</span>}
        </h1>
      )}

      <div className="relative z-10 shrink-0 flex items-center gap-1">
        {actions}
      </div>
    </div>
  );
}
