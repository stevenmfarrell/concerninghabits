'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  id: string;
  label: string;
  icon?: ReactNode;
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
        className="w-full h-[42px] flex items-center justify-between px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left text-sm text-stone-900 shadow-sm disabled:opacity-50 transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {selectedOption ? (
            <>
              {selectedOption.icon && <div className="shrink-0">{selectedOption.icon}</div>}
              <span className="truncate">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-stone-400 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 w-full mt-2 bg-white border border-stone-100 rounded-xl shadow-lg py-1 max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(option.id);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-stone-50 transition-colors ${
                value === option.id ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-stone-700'
              }`}
            >
              {option.icon && <div className={`shrink-0 ${value === option.id ? 'text-emerald-600' : 'text-stone-400'}`}>{option.icon}</div>}
              <span className="truncate">{option.label}</span>
            </button>
          ))}
          
          {footer && (
            <>
              <div className="h-px bg-stone-100 my-1"></div>
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
