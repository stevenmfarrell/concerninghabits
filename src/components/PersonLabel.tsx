import type { Person } from '@/lib/userColors';

// A person's color swatch and name, as used to tell who logged what on a shared habit
export default function PersonLabel({ person, size = 'xs', className = '' }: { person: Person | undefined; size?: 'xs' | 'sm'; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium text-stone-600 ${size === 'sm' ? 'text-sm' : 'text-xs'} ${className}`}>
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: person?.color ?? '#a8a29e' }} />
      <span className="truncate">{person?.name ?? 'Former member'}</span>
    </span>
  );
}
