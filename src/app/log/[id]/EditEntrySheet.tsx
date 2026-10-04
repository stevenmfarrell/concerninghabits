'use client';

import { useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateHabitLog } from '@/app/actions/db';
import { Button } from '@/components/ui/Button';
import BottomSheet from '@/components/BottomSheet';
import { HABIT_FORM_WIDGETS, habitFormUiSchema, parseHabitSchema, type HabitFormProperties } from '@/components/widgets/habitForm';
import { INPUT } from '@/components/ui/Input';

export interface EditableEntry {
  id: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

// A time as a datetime-local input's value ("2026-10-03T13:06"), in the browser's time zone, which
// is also how the input's value is read back
function toInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// The entry sheet for correcting an entry already logged: its values (the habit's form, if it has
// one) and when it happened. Unlike logging, no voice or photo fill-in: this is for fixing by hand.
export default function EditEntrySheet({ habit, entry, onClose }: {
  habit: { id: string; name: string; schema: string };
  entry: EditableEntry;
  onClose: () => void;
}) {
  const schema = parseHabitSchema(habit.schema);
  const properties = schema.properties as HabitFormProperties | undefined;
  const hasForm = Object.keys(properties ?? {}).length > 0;

  const initialTime = toInputValue(new Date(entry.createdAt));
  const [formData, setFormData] = useState<Record<string, unknown>>(entry.payload);
  const [time, setTime] = useState(initialTime);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!time) {
      toast.error('Pick when this happened');
      return;
    }
    setSaving(true);
    try {
      // Only sent when changed, since the input drops the seconds the entry was logged with
      await updateHabitLog(entry.id, habit.id, formData, time !== initialTime ? new Date(time) : undefined);
      toast.success('Entry updated');
      onClose();
    } catch (err) {
      toast.error(`Failed to update entry: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setSaving(false);
    }
  };

  const saveButton = (
    <Button type={hasForm ? 'submit' : 'button'} size="xl" disabled={saving} className="w-full" onClick={hasForm ? undefined : save}>
      {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" strokeWidth={2.5} />}
      {saving ? 'Saving...' : 'Save Changes'}
    </Button>
  );

  return (
    <BottomSheet title={`Edit ${habit.name} entry`} onClose={onClose}>
      <div>
        <label htmlFor={`entry-time-${entry.id}`} className="block text-sm font-medium text-ink-secondary mb-2">Date & Time</label>
        <input
          id={`entry-time-${entry.id}`}
          type="datetime-local"
          className={INPUT}
          value={time}
          onChange={e => setTime(e.target.value)}
          disabled={saving}
        />
      </div>

      {hasForm ? (
        <div className="rjsf-custom">
          <Form
            schema={{ ...schema, title: '' }}
            uiSchema={habitFormUiSchema(properties)}
            widgets={HABIT_FORM_WIDGETS}
            validator={validator}
            formData={formData}
            onChange={e => setFormData(e.formData)}
            onSubmit={save}
            disabled={saving}
            noHtml5Validate
            showErrorList={false}
            className="rjsf space-y-6"
          >
            {saveButton}
          </Form>
        </div>
      ) : saveButton}
    </BottomSheet>
  );
}
