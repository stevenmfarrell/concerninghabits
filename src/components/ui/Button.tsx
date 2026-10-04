import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-ghost' | 'inverse' | 'inverse-ghost';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover shadow-sm',
  secondary: 'bg-inverse text-on-inverse hover:bg-inverse-hover',
  outline: 'bg-surface-subtle text-ink-secondary border border-line hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:bg-danger-hover',
  'danger-ghost': 'text-danger-ink hover:bg-danger-soft',
  // For dark emerald surfaces, e.g. the smart entry panel. That panel is the same deep emerald in
  // both themes, so these keep fixed colors rather than the theme's.
  inverse: 'bg-white text-emerald-800 hover:bg-emerald-50 shadow-sm',
  'inverse-ghost': 'text-emerald-100 hover:text-white hover:bg-white/10',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  // For a section heading's controls (see PaneHeading), all 32px tall
  xs: 'h-8 px-3 text-sm rounded-lg gap-1.5',
  sm: 'px-4 py-2 text-sm rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3 rounded-xl gap-2',
  xl: 'px-8 py-4 text-lg rounded-xl gap-3',
};

const BASE = 'inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') {
  return [BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className].filter(Boolean).join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return <button {...props} className={buttonClasses(variant, size, className)} />;
}

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function LinkButton({ variant = 'primary', size = 'md', className = '', ...props }: LinkButtonProps) {
  return <Link {...props} className={buttonClasses(variant, size, className)} />;
}
