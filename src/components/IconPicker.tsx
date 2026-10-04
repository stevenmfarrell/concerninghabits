'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { INPUT_SM } from '@/components/ui/Input';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';

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

  const CurrentIcon = iconsByName[value] || iconsByName[DEFAULT_CATEGORY_ICON];

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`${INPUT_SM} w-auto flex items-center justify-center text-ink-secondary hover:bg-surface-muted`}
        title="Choose Icon"
      >
        <CurrentIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute z-[100] left-0 top-full mt-1 w-64 bg-surface border border-line rounded-xl shadow-xl p-2">
          <input
            type="text"
            placeholder="Search icons..."
            className={`${INPUT_SM} mb-2`}
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
                  className={`p-2 flex items-center justify-center rounded-lg hover:bg-accent-soft hover:text-accent-ink transition-colors ${value === name ? 'bg-accent-soft-strong text-accent-ink-strong' : 'text-ink-secondary'}`}
                  title={name}
                >
                  <IconComp className="w-4 h-4" />
                </button>
              );
            })}
            {filteredIcons.length === 0 && (
              <div className="col-span-6 text-center py-4 text-sm text-ink-muted">
                No icons found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
