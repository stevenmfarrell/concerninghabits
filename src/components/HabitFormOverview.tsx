'use client';

import { useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import BottomSheet from './BottomSheet';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { HABIT_FORM_WIDGETS, habitFormUiSchema, type HabitFormProperties } from './widgets/habitForm';
import type { HabitSchema } from '@/lib/types';

type FieldSchema = HabitFormProperties[string] & { enum?: unknown[]; format?: string };

// What kind of answer a field takes, in words, e.g. "Number (miles)", "Duration", "One of: Low, High"
function describeField(field: FieldSchema) {
  const unit = field['x-unit'] ? ` (${field['x-unit']})` : '';
  if (field['x-widget'] === 'duration') return 'Duration';
  if (field['x-widget'] === 'textarea') return 'Long text';
  if (Array.isArray(field.enum) && field.enum.length > 0) return `One of: ${field.enum.join(', ')}`;
  switch (field.type) {
    case 'integer': return `Whole number${unit}`;
    case 'number': return `Number${unit}`;
    case 'boolean': return 'Yes or no';
    case 'array': return 'List';
    case 'string': return field.format === 'date' ? 'Date' : field.format === 'date-time' ? 'Date and time' : 'Text';
    default: return 'Value';
  }
}

// The habit's form in the editor: its fields listed as plain text
export default function HabitFormOverview({ schema }: { schema: HabitSchema }) {
  const properties = (schema.properties ?? {}) as Record<string, FieldSchema>;
  const fields = Object.entries(properties);
  const required = new Set(schema.required ?? []);

  if (fields.length === 0) {
    return (
      <p className="text-sm text-stone-500 p-4 bg-stone-50 border border-stone-100 rounded-xl">
        No fields: logging it is a single tap.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-stone-100 border border-stone-100 rounded-xl">
      {fields.map(([key, field]) => (
        <li key={key} className="flex items-baseline gap-3 px-4 py-3">
          <span className="font-medium text-stone-800 min-w-0 truncate">{field.title || key}</span>
          <span className="flex-1 min-w-0 text-sm text-stone-500 truncate">{describeField(field)}</span>
          <span className={`text-xs font-medium shrink-0 ${required.has(key) ? 'text-emerald-700' : 'text-stone-400'}`}>
            {required.has(key) ? 'Required' : 'Optional'}
          </span>
        </li>
      ))}
    </ul>
  );
}

// A button to try the habit's real form, in a pane like the one used to log it. Nothing is logged.
export function FormPreviewButton({ schema, title }: { schema: HabitSchema; title: string }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const properties = (schema.properties ?? {}) as Record<string, FieldSchema>;
  const hasFields = Object.keys(properties).length > 0;

  return (
    <>
      <IconButton variant="accent" edge="right" onClick={() => setPreviewOpen(true)} title="Preview form" aria-label="Preview form">
        <Eye className="w-5 h-5" />
      </IconButton>

      {previewOpen && (
        <BottomSheet title={title || 'New Habit'} ariaLabel="Form preview" onClose={() => setPreviewOpen(false)}>
          <p className="text-sm text-stone-500 -mt-3">A preview: nothing is logged.</p>
          {hasFields ? (
            <div className="rjsf-custom">
              <Form
                schema={{ ...schema, title: '' }}
                uiSchema={habitFormUiSchema(properties)}
                widgets={HABIT_FORM_WIDGETS}
                validator={validator}
                onSubmit={() => toast.success('Form valid! (Preview: nothing was saved)')}
                noHtml5Validate
                showErrorList={false}
                className="rjsf space-y-6"
              >
                <Button type="submit" variant="secondary" size="xl" className="w-full">
                  Test Submit
                </Button>
              </Form>
            </div>
          ) : (
            <p className="text-stone-600">This habit has no form: its Log button logs it straight away.</p>
          )}
        </BottomSheet>
      )}
    </>
  );
}
