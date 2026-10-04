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
import { calculatedFieldProblem, describeExpression, type CalculatedField } from '@/lib/calculatedFields';

// The habit's form in the editor: its fields as rows of plain text, in a pane's list (see Pane). With
// `onEditField`, each field is a button to change it, and `onAddField` adds a last row for a new one.
export default function HabitFormOverview({ schema, onEditField, onAddField }: {
  schema: HabitSchema;
  onEditField?: (key: string) => void;
  onAddField?: () => void;
}) {
  const fields = Object.entries(fieldsOf(schema));
  const required = new Set(schema.required ?? []);

  return (
    <ul className="divide-y divide-line-subtle">
      {fields.length === 0 && (
        <li className="pane-inset py-3 text-sm text-ink-muted">No fields: logging it is a single tap.</li>
      )}
      {fields.map(([key, field]) => {
        const row = (
          <>
            <span className="font-medium text-ink min-w-0 truncate">{field.title || key}</span>
            <span className="flex-1 min-w-0 text-sm text-ink-muted truncate">{describeField(field)}</span>
            <span className={`text-xs font-medium shrink-0 ${required.has(key) ? 'text-accent-ink-strong' : 'text-ink-subtle'}`}>
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
                className="w-full flex items-center gap-3 pane-inset py-3 text-left hover:bg-surface-subtle transition-colors"
                aria-label={`Edit field ${field.title || key}`}
              >
                {row}
                <ChevronRight className="w-4 h-4 text-ink-faint shrink-0" />
              </button>
            ) : (
              <div className="flex items-baseline gap-3 pane-inset py-3">{row}</div>
            )}
          </li>
        );
      })}
      {/* A row like the fields rather than a Button, so it reads as the end of the list */}
      {onAddField && (
        <li>
          <button
            type="button"
            onClick={onAddField}
            className="w-full flex items-center gap-2 pane-inset py-3 text-left text-sm font-medium text-accent-ink-strong hover:bg-surface-subtle transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add field
          </button>
        </li>
      )}
    </ul>
  );
}

// A button to try the habit's real form, in a pane like the one used to log it. Nothing is logged.
export function FormPreviewButton({ schema, title }: { schema: HabitSchema; title: string }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const properties = fieldsOf(schema) as HabitFormProperties;
  const hasFields = Object.keys(properties).length > 0;

  return (
    <>
      <Button variant="ghost" size="xs" onClick={() => setPreviewOpen(true)} className="-mr-3">
        <Eye className="w-4 h-4" />
        Preview form
      </Button>

      {previewOpen && (
        <BottomSheet title={title || 'New Habit'} ariaLabel="Form preview" onClose={() => setPreviewOpen(false)}>
          <p className="text-sm text-ink-muted -mt-3">A preview: nothing is logged.</p>
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
            <p className="text-ink-secondary">This habit has no form: its Log button logs it straight away.</p>
          )}
        </BottomSheet>
      )}
    </>
  );
}

// The habit's calculated fields in the editor, as rows like the form's fields: each one's formula
// in words, or what it needs fixing for when it doesn't work with the form as it is (e.g. a field
// it uses was removed). With `onEdit`, each is a button to change it, and `onAdd` adds a last row.
export function CalculatedFieldsOverview({ fields, schema, onEdit, onAdd }: {
  fields: CalculatedField[];
  schema: HabitSchema;
  onEdit?: (key: string) => void;
  onAdd?: () => void;
}) {
  return (
    <ul className="divide-y divide-line-subtle">
      {fields.map(field => {
        const problem = calculatedFieldProblem(field, schema);
        const row = (
          <>
            <span className="font-medium text-ink min-w-0 truncate">{field.title}</span>
            {problem ? (
              <span className="flex-1 min-w-0 text-sm text-danger-ink truncate" title={problem}>{problem}</span>
            ) : (
              <span className="flex-1 min-w-0 text-sm text-ink-muted truncate">
                = {describeExpression(field.expression, schema)}{field.unit ? ` · ${field.unit}` : ''}
              </span>
            )}
          </>
        );
        return (
          <li key={field.key}>
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(field.key)}
                className="w-full flex items-center gap-3 pane-inset py-3 text-left hover:bg-surface-subtle transition-colors"
                aria-label={`Edit calculated field ${field.title}`}
              >
                {row}
                <ChevronRight className="w-4 h-4 text-ink-faint shrink-0" />
              </button>
            ) : (
              <div className="flex items-baseline gap-3 pane-inset py-3">{row}</div>
            )}
          </li>
        );
      })}
      {onAdd && (
        <li>
          <button
            type="button"
            onClick={onAdd}
            className="w-full flex items-center gap-2 pane-inset py-3 text-left text-sm font-medium text-accent-ink-strong hover:bg-surface-subtle transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add calculated field
          </button>
        </li>
      )}
    </ul>
  );
}
