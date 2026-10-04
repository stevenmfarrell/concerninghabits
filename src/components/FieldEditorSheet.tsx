'use client';

import { useState } from 'react';
import { Asterisk, Check, Trash2 } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { Button } from './ui/Button';
import { Toggle } from './ui/Toggle';
import { FIELD_TYPES, settingsProblem, type FieldSettings } from '@/lib/formFields';
import { INPUT_SM, TEXTAREA_SM } from '@/components/ui/Input';
import Select from './Select';


const NEW_FIELD: FieldSettings = { title: '', type: 'text', unit: '', choices: [], required: false };

// One field of a habit's form, to add or change: its name, its type (and a number's unit, or a
// choice's options), and whether an entry needs it. Changes go back to the editor with `onDone`,
// to be saved with the rest of the habit.
//
// `loggedBefore` marks a field the habit already had when the editor opened (so entries may have
// values for it), which changing its type or removing it doesn't touch.
//
// `usedBy` names the calculated fields whose formulas use this field, which changing its type or
// removing it would leave needing fixing.
export default function FieldEditorSheet({ initial, loggedBefore, usedBy = [], onDone, onRemove, onClose }: {
  initial?: FieldSettings;
  loggedBefore: boolean;
  usedBy?: string[];
  onDone: (settings: FieldSettings) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<FieldSettings>(initial ?? NEW_FIELD);
  // Choices as typed, one per line, so blank lines can be typed through
  const [choicesText, setChoicesText] = useState(settings.choices.join('\n'));
  const set = (change: Partial<FieldSettings>) => setSettings(prev => ({ ...prev, ...change }));

  const problem = settingsProblem(settings);
  const typeChanged = !!initial && settings.type !== initial.type;
  // A field of a kind the editor doesn't build (e.g. a date the AI made) keeps its type; it can only
  // be renamed, made optional or required, or removed
  const types = settings.type === 'other' ? [{ id: 'other', label: 'Other (kept as it is)' }] : FIELD_TYPES;

  return (
    <BottomSheet title={initial ? 'Edit field' : 'Add field'} onClose={onClose}>
      <form
        className="space-y-5"
        onSubmit={e => {
          e.preventDefault();
          if (!problem) onDone(settings);
        }}
      >
        <label className="block space-y-1.5">
          <span className="block text-sm font-medium text-ink-secondary">Name</span>
          <input
            type="text"
            className={INPUT_SM}
            value={settings.title}
            onChange={e => set({ title: e.target.value })}
            placeholder='e.g. "Pages read"'
            autoFocus={!initial}
            autoComplete="off"
            data-1p-ignore
          />
        </label>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-ink-secondary">Type</span>
          <Select
            size="sm"
            value={settings.type}
            onChange={type => set({ type: type as FieldSettings['type'] })}
            options={types.map(t => ({ id: t.id, label: t.label }))}
            disabled={settings.type === 'other'}
          />
          {typeChanged && loggedBefore && (
            <p className="text-xs text-warning-ink-strong">
              Entries already logged keep the values they have. One that doesn&apos;t fit the new type shows as it was, and needs fixing if you edit that entry.
            </p>
          )}
        </div>

        {(settings.type === 'number' || settings.type === 'integer') && (
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-ink-secondary">Unit <span className="font-normal text-ink-subtle">(optional)</span></span>
            <input
              type="text"
              className={INPUT_SM}
              value={settings.unit}
              onChange={e => set({ unit: e.target.value })}
              placeholder='e.g. "miles", "pages", "lbs"'
              autoComplete="off"
              data-1p-ignore
            />
          </label>
        )}

        {settings.type === 'choice' && (
          <label className="block space-y-1.5">
            <span className="block text-sm font-medium text-ink-secondary">Choices</span>
            <textarea
              className={`${TEXTAREA_SM} min-h-28`}
              value={choicesText}
              onChange={e => {
                setChoicesText(e.target.value);
                set({ choices: e.target.value.split('\n') });
              }}
              placeholder={'One per line, e.g.\nGreat\nOkay\nRough'}
            />
          </label>
        )}

        <Toggle
          icon={<Asterisk className="w-5 h-5" />}
          title="Required"
          description="An entry can't be logged without it"
          checked={settings.required}
          onChange={required => set({ required })}
        />

        <div className={`flex items-center gap-3 ${onRemove ? 'justify-between' : 'justify-end'}`}>
          {onRemove && (
            <Button type="button" variant="danger-ghost" onClick={onRemove}>
              <Trash2 className="w-4 h-4" />
              Remove field
            </Button>
          )}
          <Button type="submit" disabled={!!problem} title={problem ?? undefined}>
            <Check className="w-4 h-4" />
            Done
          </Button>
        </div>
        {usedBy.length > 0 && (
          <p className="text-xs text-warning-ink-strong -mt-2">
            Used by {usedBy.join(', ')}. Removing it, or making it something other than a number or yes or no, leaves {usedBy.length === 1 ? 'that' : 'those'} needing a new formula.
          </p>
        )}
        {loggedBefore && onRemove && (
          <p className="text-xs text-ink-muted -mt-2">Removing a field hides it from the form; values already logged for it are kept.</p>
        )}
      </form>
    </BottomSheet>
  );
}
