import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';

export type IconButtonVariant = 'default' | 'accent' | 'soft' | 'solid' | 'danger';
export type IconButtonEdge = 'left' | 'right' | 'none';

const VARIANT_CLASSES: Record<IconButtonVariant, string> = {
  default: 'text-stone-500 hover:text-stone-800 hover:bg-stone-100',
  accent: 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50',
  // Pale emerald, for an action repeated down a list, e.g. each row's Log button, so a column of
  // them doesn't outweigh the rows themselves
  soft: 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 hover:border-emerald-200 disabled:opacity-60',
  // Filled emerald, for a primary action, e.g. sending something typed
  solid: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-60',
  danger: 'text-red-600 hover:text-red-700 hover:bg-red-50',
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
