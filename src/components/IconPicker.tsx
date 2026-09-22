'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';

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

  const CurrentIcon = (LucideIcons as any)[value] || LucideIcons.List;

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="h-[38px] px-3 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
        title="Choose Icon"
      >
        <CurrentIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute z-[100] left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-2">
          <input
            type="text"
            placeholder="Search icons..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto p-1 custom-scrollbar">
            {filteredIcons.map((name) => {
              const IconComp = (LucideIcons as any)[name];
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
                  className={`p-2 flex items-center justify-center rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors ${value === name ? 'bg-blue-100 text-blue-700' : 'text-slate-600'}`}
                  title={name}
                >
                  <IconComp className="w-4 h-4" />
                </button>
              );
            })}
            {filteredIcons.length === 0 && (
              <div className="col-span-6 text-center py-4 text-sm text-slate-500">
                No icons found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
