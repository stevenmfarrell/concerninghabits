import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';

export type IconButtonVariant = 'default' | 'accent' | 'soft' | 'solid' | 'danger';
export type IconButtonEdge = 'left' | 'right' | 'none';

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  default: 'text-ink-muted hover:text-ink hover:bg-surface-muted',
  accent: 'text-accent-ink hover:text-accent-ink-strong hover:bg-accent-soft',
  // Pale emerald, for an action repeated down a list, e.g. each row's Log button, so a column of
  // them doesn't outweigh the rows themselves
  soft: 'bg-accent-soft text-accent-ink-strong border border-accent-line hover:bg-accent-soft-strong hover:border-accent-line-strong disabled:opacity-60',
  // Filled emerald, for a primary action, e.g. sending something typed
  solid: 'bg-accent text-on-accent hover:bg-accent-hover shadow-sm disabled:opacity-60',
  danger: 'text-danger-ink hover:text-danger-ink-strong hover:bg-danger-soft',
};

const EDGE_CLASSES: Record<IconButtonEdge, string> = {
  left: '-ml-2',
  right: '-mr-2',
  none: '',
};

const BASE = 'p-2 rounded-full transition-colors shrink-0 inline-flex items-center justify-center';

function classes(variant: IconButtonVariant, edge: IconButtonEdge, className: string) {
  return [BASE, EDGE_CLASSES[edge], VARIANT_CLASSES[variant], className].filter(Boolean).join(' ');
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  edge?: IconButtonEdge;
}

export function IconButton({ variant = 'default', edge = 'none', className = '', ...props }: IconButtonProps) {
  return <button {...props} className={classes(variant, edge, className)} />;
}

interface IconLinkButtonProps extends ComponentProps<typeof Link> {
  variant?: IconButtonVariant;
  edge?: IconButtonEdge;
}

export function IconLinkButton({ variant = 'default', edge = 'none', className = '', ...props }: IconLinkButtonProps) {
  return <Link {...props} className={classes(variant, edge, className)} />;
}
