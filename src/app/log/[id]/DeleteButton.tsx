'use client';

import { MoreVertical, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import ConfirmDialog from '../../../components/ConfirmDialog';

export default function DeleteButton({ action }: { action: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div className="relative inline-block text-left" ref={containerRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-stone-400 hover:text-stone-700 transition-colors rounded-lg hover:bg-stone-100"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-32 origin-top-right rounded-xl bg-white shadow-lg border border-stone-100 focus:outline-none z-50 overflow-hidden">
          <div>
            <button 
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowConfirm(true);
              }}
              className="flex items-center gap-2 w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        title="Delete Log Entry"
        message="Are you sure you want to delete this log entry? This cannot be undone."
        confirmText="Delete Entry"
        onConfirm={() => {
          action();
          setShowConfirm(false);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
