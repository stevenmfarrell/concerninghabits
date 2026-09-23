'use client';

import { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import { ChevronDown, Plus } from 'lucide-react';

interface CategorySelectProps {
  categories: any[];
  value: string;
  onChange: (id: string) => void;
  onNew: () => void;
  disabled?: boolean;
}

export default function CategorySelect({ categories, value, onChange, onNew, disabled }: CategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCategory = categories.find(c => c.id === value);

  // Close dropdown when clicking outside
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
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-48 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex items-center justify-between disabled:opacity-50 transition-colors"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {selectedCategory ? (
            <>
              <Icon name={selectedCategory.icon || 'List'} className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">{selectedCategory.name}</span>
            </>
          ) : (
            <span className="text-stone-400">Select Category</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-stone-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-stone-100 rounded-xl shadow-lg py-1 max-h-60 overflow-auto">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.id);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-stone-50 transition-colors ${
                value === c.id ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-stone-700'
              }`}
            >
              <Icon name={c.icon || 'List'} className={`w-4 h-4 ${value === c.id ? 'text-emerald-600' : 'text-stone-400'}`} />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
          
          <div className="h-px bg-stone-100 my-1"></div>
          
          <button
            type="button"
            onClick={() => {
              onNew();
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-emerald-600 hover:bg-emerald-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium">New Category</span>
          </button>
        </div>
      )}
    </div>
  );
}
