'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { MENU_PANEL, MENU_SEPARATOR, menuOptionClasses } from '@/components/ui/Menu';

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
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled,
  footer,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.id === value);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-[42px] flex items-center justify-between px-3 py-2 bg-surface border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-focus text-left text-sm text-ink shadow-sm disabled:opacity-50 transition-colors"
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

      {isOpen && (
        <div className={`${MENU_PANEL} absolute left-0 top-full mt-1 w-full max-h-60 overflow-auto`}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(option.id);
                setIsOpen(false);
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
              <div onClick={() => setIsOpen(false)}>
                {footer}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
