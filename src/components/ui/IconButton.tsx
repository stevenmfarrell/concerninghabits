import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';

export type IconButtonVariant = 'default' | 'accent' | 'soft' | 'category-soft' | 'solid' | 'danger';
export type IconButtonEdge = 'left' | 'right' | 'none';
// `sm` is for a section heading's controls (see PaneHeading), 32px tall with a w-5 icon
export type IconButtonSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  default: 'text-ink-muted hover:text-ink hover:bg-surface-muted',
  accent: 'text-accent-ink hover:text-accent-ink-strong hover:bg-accent-soft',
  // Pale emerald, for an action repeated down a list, e.g. each row's Log button, so a column of
  // them doesn't outweigh the rows themselves
  soft: 'bg-accent-soft text-accent-ink-strong border border-accent-line hover:bg-accent-soft-strong hover:border-accent-line-strong',
  // Pale blue, the same for something done with a category, e.g. its Agenda row's button to pick a
  // habit in it to log
  'category-soft': 'bg-category-soft text-category-ink-strong border border-category-line hover:bg-category-soft-strong',
  // Filled emerald, for a primary action, e.g. sending something typed
  solid: 'bg-accent text-on-accent hover:bg-accent-hover shadow-sm',
  danger: 'text-danger-ink hover:text-danger-ink-strong hover:bg-danger-soft',
};

// Pulls the button out by its padding, so its icon lines up with the edge
const EDGE_CLASSES: Record<IconButtonSize, Record<IconButtonEdge, string>> = {
  md: { left: '-ml-2', right: '-mr-2', none: '' },
  sm: { left: '-ml-1.5', right: '-mr-1.5', none: '' },
};

const SIZE_CLASSES: Record<IconButtonSize, string> = { md: 'p-2', sm: 'p-1.5' };

const BASE = 'rounded-full transition-colors shrink-0 inline-flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none';

function classes(variant: IconButtonVariant, edge: IconButtonEdge, size: IconButtonSize, className: string) {
  return [BASE, SIZE_CLASSES[size], EDGE_CLASSES[size][edge], VARIANT_CLASSES[variant], className].filter(Boolean).join(' ');
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  edge?: IconButtonEdge;
  size?: IconButtonSize;
}

export function IconButton({ variant = 'default', edge = 'none', size = 'md', className = '', ...props }: IconButtonProps) {
  return <button {...props} className={classes(variant, edge, size, className)} />;
}

interface IconLinkButtonProps extends ComponentProps<typeof Link> {
  variant?: IconButtonVariant;
  edge?: IconButtonEdge;
  size?: IconButtonSize;
}

export function IconLinkButton({ variant = 'default', edge = 'none', size = 'md', className = '', ...props }: IconLinkButtonProps) {
  return <Link {...props} className={classes(variant, edge, size, className)} />;
}
