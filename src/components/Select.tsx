'use client';

import { useState, useRef, useEffect, ReactNode, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { MENU_PANEL, MENU_SEPARATOR, menuOptionClasses } from '@/components/ui/Menu';
import { INPUT, INPUT_SM } from '@/components/ui/Input';

export interface SelectOption {
  id: string;
  label: string;
  icon?: ReactNode;
  depth?: number;          // indent level in the open list
  selectedLabel?: string;  // shown in the closed trigger instead of label, e.g. with the parent's name
}

export interface SelectProps {
  value: string;
  onChange: (id: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  footer?: ReactNode;
  // Matches the text inputs beside it: `md` for a form's fields, `sm` in a dialog or sheet (see Input)
  size?: 'sm' | 'md';
}

// The open list's tallest, and the gap it keeps from the trigger and the screen's edges
const MENU_MAX_HEIGHT = 288;
const MENU_GAP = 4;
const SCREEN_MARGIN = 8;

// Where the open list goes: below the trigger, or above it when there's more room there (e.g. a
// field near the bottom of a sheet), as tall as fits up to MENU_MAX_HEIGHT. Fixed to the screen
// rather than inside the trigger's container, so a sheet or dialog that scrolls can't clip it.
function menuPosition(trigger: HTMLElement): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - MENU_GAP - SCREEN_MARGIN;
  const above = rect.top - MENU_GAP - SCREEN_MARGIN;
  const openUp = below < MENU_MAX_HEIGHT && above > below;
  return {
    position: 'fixed',
    left: rect.left,
    width: rect.width,
    maxHeight: Math.min(MENU_MAX_HEIGHT, openUp ? above : below),
    // Above dialogs and sheets (see OVERLAY)
    zIndex: 70,
    ...(openUp ? { bottom: window.innerHeight - rect.top + MENU_GAP } : { top: rect.bottom + MENU_GAP }),
  };
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled,
  footer,
  size = 'md',
}: SelectProps) {
  // The open list's position, or null while it's closed
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const isOpen = menuStyle !== null;
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value);
  const close = () => setMenuStyle(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    // The list is placed once when it opens, so it closes rather than drifting from the trigger
    // when the page (or the sheet it's in) scrolls, or the window resizes. Scrolling the list
    // itself doesn't count.
    const handleScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={e => setMenuStyle(isOpen ? null : menuPosition(e.currentTarget))}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`${size === 'sm' ? INPUT_SM : INPUT} flex items-center justify-between text-left`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {selectedOption ? (
            <>
              {selectedOption.icon && <div className="shrink-0">{selectedOption.icon}</div>}
              <span className="truncate">{selectedOption.selectedLabel ?? selectedOption.label}</span>
            </>
          ) : (
            <span className="text-ink-subtle truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-ink-subtle shrink-0" />
      </button>

      {menuStyle && createPortal(
        <div ref={menuRef} role="listbox" className={`${MENU_PANEL} overflow-auto`} style={menuStyle}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={value === option.id}
              onClick={() => {
                onChange(option.id);
                close();
              }}
              className={`${menuOptionClasses(value === option.id)} px-3`}
              style={option.depth ? { paddingLeft: `${0.75 + option.depth * 1.25}rem` } : undefined}
            >
              {option.icon && <div className={`shrink-0 ${value === option.id ? 'text-accent-ink' : 'text-ink-subtle'}`}>{option.icon}</div>}
              <span className="truncate">{option.label}</span>
            </button>
          ))}
          
          {footer && (
            <>
              <div className={MENU_SEPARATOR} />
              <div onClick={close}>
                {footer}
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
