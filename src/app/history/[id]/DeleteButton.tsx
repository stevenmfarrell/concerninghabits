'use client';

import { Trash2 } from 'lucide-react';

export default function DeleteButton({ action }: { action: () => void }) {
  return (
    <form 
      action={action} 
      onSubmit={(e) => {
        if (!confirm('Are you sure you want to delete this log entry? This cannot be undone.')) {
          e.preventDefault();
        }
      }}
    >
      <button 
        type="submit"
        title="Delete Entry"
        className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 p-2"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </form>
  );
}
