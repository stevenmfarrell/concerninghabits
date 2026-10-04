'use client';

import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import EditEntrySheet, { type EditableEntry } from './EditEntrySheet';
import { MENU_ITEM, MENU_ITEM_DANGER, MENU_PANEL } from '@/components/ui/Menu';

// Room the menu needs below its button to open downward: its own height, plus the bottom nav's
const MENU_CLEARANCE = 200;

// An entry's menu in the habit page's Log Entries table: edit its values or time, or delete it
export default function EntryMenu({ habit, entry, deleteAction }: {
  habit: { id: string; name: string; schema: string };
  entry: EditableEntry;
  deleteAction: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  // Opens upward when there isn't room below the button, e.g. on the last entries near the bottom
  // nav, so the menu stays on screen
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!isOpen && rect) setOpenUp(window.innerHeight - rect.bottom < MENU_CLEARANCE);
    setIsOpen(!isOpen);
  };

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
      <IconButton onClick={toggle} title="Entry options" aria-label="Entry options">
        <MoreVertical className="w-5 h-5" />
      </IconButton>

      {isOpen && (
        <div className={`${MENU_PANEL} absolute right-0 w-32 ${openUp ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'} overflow-hidden`}>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setEditing(true);
            }}
            className={MENU_ITEM}
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setShowConfirm(true);
            }}
            className={MENU_ITEM_DANGER}
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
