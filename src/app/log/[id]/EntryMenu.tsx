'use client';

import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import EditEntrySheet, { type EditableEntry } from './EditEntrySheet';

// An entry's menu in the habit page's Log Entries table: edit its values or time, or delete it
export default function EntryMenu({ habit, entry, deleteAction }: {
  habit: { id: string; name: string; schema: string };
  entry: EditableEntry;
  deleteAction: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
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
      <IconButton onClick={() => setIsOpen(!isOpen)} title="Entry options" aria-label="Entry options">
        <MoreVertical className="w-5 h-5" />
      </IconButton>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-32 origin-top-right rounded-xl bg-white shadow-lg border border-stone-100 focus:outline-none z-50 overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setEditing(true);
            }}
            className="flex items-center gap-2 w-full text-left px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors"
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
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
      )}

      {editing && <EditEntrySheet habit={habit} entry={entry} onClose={() => setEditing(false)} />}

      <ConfirmDialog
        isOpen={showConfirm}
        title="Delete Log Entry"
        message="Are you sure you want to delete this log entry? This cannot be undone."
        confirmText="Delete Entry"
        onConfirm={() => {
          deleteAction();
          setShowConfirm(false);
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
