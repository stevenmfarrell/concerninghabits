'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const iconsByName = LucideIcons as unknown as Record<string, LucideIcon>;

const allIconNames = Object.keys(LucideIcons).filter(
  name => /^[A-Z]/.test(name) && !name.endsWith('Icon') && name !== 'LucideIcon'
);

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  disabled?: boolean;
}

export default function IconPicker({ value, onChange, disabled }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const filteredIcons = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return allIconNames.slice(0, 150); // Show first 150 when no search
    return allIconNames.filter(name => name.toLowerCase().includes(term)).slice(0, 150);
  }, [search]);

  const CurrentIcon = iconsByName[value] || LucideIcons.List;

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="h-[38px] px-3 bg-white border border-stone-200 rounded-lg flex items-center justify-center text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
        title="Choose Icon"
      >
        <CurrentIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute z-[100] left-0 mt-1 w-64 bg-white border border-stone-200 rounded-xl shadow-xl p-2">
          <input
            type="text"
            placeholder="Search icons..."
            className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto p-1 custom-scrollbar">
            {filteredIcons.map((name) => {
              const IconComp = iconsByName[name];
              if (!IconComp) return null;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(name);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`p-2 flex items-center justify-center rounded-lg hover:bg-emerald-50 hover:text-emerald-600 transition-colors ${value === name ? 'bg-emerald-100 text-emerald-700' : 'text-stone-600'}`}
                  title={name}
                >
                  <IconComp className="w-4 h-4" />
                </button>
              );
            })}
            {filteredIcons.length === 0 && (
              <div className="col-span-6 text-center py-4 text-sm text-stone-500">
                No icons found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
