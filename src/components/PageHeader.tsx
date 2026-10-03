import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import BackButton from '@/components/BackButton';
import { IconLinkButton } from '@/components/ui/IconButton';

interface PageHeaderProps {
  title: ReactNode;
  /** Href for the back control. Omit to fall back to browser history (router.back()). */
  backHref?: string;
  /** Right-side slot: an icon button, a menu, or a compact action link. */
  actions?: ReactNode;
  /** Horizontal padding reserved so the absolutely-centered title doesn't collide with back/actions. */
  titleInsetClassName?: string;
}

export default function PageHeader({ title, backHref, actions, titleInsetClassName = 'px-14' }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-stone-200 px-4 py-3 sm:px-8 sm:py-4 flex items-center justify-between shadow-sm">
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

      <div className="relative z-10 shrink-0 flex items-center gap-1">
        {actions}
      </div>
    </div>
  );
}
