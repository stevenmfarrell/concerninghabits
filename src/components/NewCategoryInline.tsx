'use client';

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import IconPicker from './IconPicker';
import { IconButton } from '@/components/ui/IconButton';
import { INPUT_SM } from '@/components/ui/Input';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';

interface Props {
  onSave: (name: string, icon: string) => Promise<void>;
  onCancel: () => void;
  defaultIcon?: string;
}

export default function NewCategoryInline({ onSave, onCancel, defaultIcon = DEFAULT_CATEGORY_ICON }: Props) {
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
        className={`${INPUT_SM} w-auto flex-1 min-w-[100px]`}
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
        <IconButton type="button" variant="accent" size="sm" onClick={handleSave} disabled={loading || !name.trim()} title="Add category" aria-label="Add category">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
        </IconButton>
        <IconButton type="button" size="sm" edge="right" onClick={onCancel} disabled={loading} title="Cancel" aria-label="Cancel">
          <X className="w-5 h-5" />
        </IconButton>
      </div>
    </div>
  );
}
