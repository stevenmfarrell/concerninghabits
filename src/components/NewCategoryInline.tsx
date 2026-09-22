'use client';

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import IconPicker from './IconPicker';

interface Props {
  onSave: (name: string, icon: string) => Promise<void>;
  onCancel: () => void;
  defaultIcon?: string;
}

export default function NewCategoryInline({ onSave, onCancel, defaultIcon = 'List' }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(defaultIcon);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await onSave(name.trim(), icon);
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <IconPicker value={icon} onChange={setIcon} disabled={loading} />
      <input 
        type="text"
        autoFocus
        placeholder="Category Name"
        className="flex-1 min-w-[100px] px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
          }
        }}
        disabled={loading}
      />
      <div className="flex items-center gap-1 shrink-0">
        <button 
          type="button"
          onClick={handleSave}
          disabled={loading || !name.trim()}
          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button 
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
