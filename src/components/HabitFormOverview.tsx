'use client';

import { useState } from 'react';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { ChevronRight, Eye, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import BottomSheet from './BottomSheet';
import { Button } from './ui/Button';
import { HABIT_FORM_WIDGETS, habitFormUiSchema, type HabitFormProperties } from './widgets/habitForm';
import type { HabitSchema } from '@/lib/types';
import { describeField, fieldsOf } from '@/lib/formFields';

// The habit's form in the editor: its fields listed as plain text. With `onEditField`, each field
// is a button to change it, and `onAddField` adds a button for a new one.
export default function HabitFormOverview({ schema, onEditField, onAddField }: {
  schema: HabitSchema;
  onEditField?: (key: string) => void;
  onAddField?: () => void;
}) {
  const fields = Object.entries(fieldsOf(schema));
  const required = new Set(schema.required ?? []);

  return (
    <div className="space-y-2">
      {fields.length === 0 ? (
        <p className="text-sm text-stone-500 p-4 bg-stone-50 border border-stone-100 rounded-xl">
          No fields: logging it is a single tap.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 border border-stone-100 rounded-xl overflow-hidden">
          {fields.map(([key, field]) => {
            const row = (
              <>
                <span className="font-medium text-stone-800 min-w-0 truncate">{field.title || key}</span>
                <span className="flex-1 min-w-0 text-sm text-stone-500 truncate">{describeField(field)}</span>
                <span className={`text-xs font-medium shrink-0 ${required.has(key) ? 'text-emerald-700' : 'text-stone-400'}`}>
                  {required.has(key) ? 'Required' : 'Optional'}
                </span>
              </>
            );
            return (
              <li key={key}>
                {onEditField ? (
                  <button
                    type="button"
                    onClick={() => onEditField(key)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 transition-colors"
                    aria-label={`Edit field ${field.title || key}`}
                  >
                    {row}
                    <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />
                  </button>
                ) : (
                  <div className="flex items-baseline gap-3 px-4 py-3">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {onAddField && (
        <Button variant="outline" size="sm" onClick={onAddField}>
          <Plus className="w-4 h-4" />
          Add field
        </Button>
      )}
    </div>
  );
}

// A button to try the habit's real form, in a pane like the one used to log it. Nothing is logged.
export function FormPreviewButton({ schema, title }: { schema: HabitSchema; title: string }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const properties = fieldsOf(schema) as HabitFormProperties;
  const hasFields = Object.keys(properties).length > 0;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)} className="-mr-2">
        <Eye className="w-4 h-4" />
        Preview form
      </Button>

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
