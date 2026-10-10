'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Camera, Loader2, Mic, Save, Pencil, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { generateHabitSchema } from '../app/actions/habit';
import { getCategories, isMqttConfigured } from '../app/actions/db';
import CategoryQuickEdit from './CategoryQuickEdit';
import CadenceQuickEdit from './CadenceQuickEdit';
import AiContextField from './AiContextField';
import AiTweakInput from './AiTweakInput';
import CollapsibleSection from './CollapsibleSection';
import ConfirmDialog from './ConfirmDialog';
import HabitFormOverview, { CalculatedFieldsOverview, FormPreviewButton } from './HabitFormOverview';
import FieldEditorSheet from './FieldEditorSheet';
import CalculatedFieldSheet from './CalculatedFieldSheet';
import PersonLabel from './PersonLabel';
import ReminderSettings, { reminderSummary, type ReminderDraft } from './reminders/ReminderSettings';
import { Button } from './ui/Button';
import { Toggle } from './ui/Toggle';
import { PANE_INSET, PANE_SURFACE, PaneHeading, PaneSection } from './Pane';
import type { Cadence } from '@/lib/cadence';
import { fieldsOf, keyFor, settingsOf, withField, withoutField } from '@/lib/formFields';
import { fieldsUsed, isFormulaInput, parseExpression, type CalculatedField } from '@/lib/calculatedFields';
import type { ChartEntry } from '@/lib/charts';
import type { CategoryOption, HabitSchema } from '@/lib/types';
import type { Person } from '@/lib/userColors';
import type { ReminderStatus } from '@/lib/reminders';
import { MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH } from '@/lib/constants';

// Everything the editor edits about a habit. `schema` carries the form's own settings (its title,
// and whether voice and photo logging are on) as saved.
export interface HabitDraft {
  title: string;
  description: string;
  schema: HabitSchema;
  cadence: Cadence;
  categoryId: string;
  publishToMqtt: boolean;
  aiContext: string;
  // Values worked out from each entry's fields (see calculatedFields.ts)
  calculatedFields: CalculatedField[];
  // The viewer's own reminder for it, once it exists (not when creating one)
  reminder?: ReminderDraft;
}

// - create: a new habit, before it's saved (the refine page)
// - edit: the owner's own habit
// - shared: a habit shared with the viewer, who can only file it in their own categories and keep
//   their own notes for AI; the rest is shown as set by `owner`
export type HabitEditorMode = 'create' | 'edit' | 'shared';

// The page's one way out other than saving, e.g. deleting the habit, with its confirmation
export interface RemoveAction {
  label: string;
  icon: ReactNode;
  confirmTitle: string;
  confirmMessage: string;
  confirmText: string;
  onConfirm: () => Promise<void>;
}

interface HabitEditorProps {
  mode: HabitEditorMode;
  initial: HabitDraft;
  owner?: Person;
  onSave: (draft: HabitDraft) => Promise<void>;
  remove?: RemoveAction;
  // Beside the save button, e.g. whether to log the habit's first entry when it's created
  saveBarExtra?: ReactNode;
  // The viewer's categories, when the page already has them, so the category pill shows its name
  // straight away; otherwise they're fetched
  categories?: CategoryOption[];
  onChangeTitle?: (title: string) => void;
  // The habit's recent entries, to preview a calculated field's values with
  entries?: ChartEntry[];
  // For the viewer's reminder (see HabitDraft.reminder): what's been learned about when they log
  // it, their bedtime to show times by, and whether any of their devices get reminders
  reminderContext?: { status: ReminderStatus; bedtime: string; hasDevice: boolean };
  // The viewer's week start, for the days of the week in the cadence picker
  weekStartsOn: string;
}

// Whether the form's voice and photo logging are on: on unless the schema turns them off
const voiceOn = (schema: HabitSchema) => schema.enableVoice !== false;
const photoOn = (schema: HabitSchema) => schema.enablePhoto !== false;

// A draft as compared for unsaved changes, so e.g. trailing spaces or a missing (default) voice
// setting don't count as one
function comparable(draft: HabitDraft) {
  return JSON.stringify({
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
    aiContext: draft.aiContext.trim(),
    schema: { ...draft.schema, title: draft.title.trim(), enableVoice: voiceOn(draft.schema), enablePhoto: photoOn(draft.schema) },
  });
}

// The habit editor, for creating, editing, and a shared habit's own settings, as sections of a pane
// page (see Pane): where it's filed and how often it's due as pills at the top, then the habit's
// name, what its form records, then settings rarely touched, folded away with a summary. Changes are saved from a bar above the bottom nav, which shows once there's something to save.
export default function HabitEditor({ mode, initial, owner, onSave, remove, saveBarExtra, onChangeTitle, categories: initialCategories, entries, reminderContext, weekStartsOn }: HabitEditorProps) {
  const isOwner = mode !== 'shared';

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [schema, setSchema] = useState<HabitSchema>(initial.schema);
  const [enableVoice, setEnableVoice] = useState(voiceOn(initial.schema));
  const [enablePhoto, setEnablePhoto] = useState(photoOn(initial.schema));
  const [cadence, setCadence] = useState<Cadence>(initial.cadence);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [publishToMqtt, setPublishToMqtt] = useState(initial.publishToMqtt);
  const [aiContext, setAiContext] = useState(initial.aiContext);
  const [calculatedFields, setCalculatedFields] = useState<CalculatedField[]>(initial.calculatedFields);
  const [reminder, setReminder] = useState(initial.reminder);
  // Bumped by Discard, to remount fields that keep their own state (e.g. a cadence's typed number)
  const [resetKey, setResetKey] = useState(0);

  const [categories, setCategories] = useState<CategoryOption[]>(initialCategories ?? []);
  const [mqttConfigured, setMqttConfigured] = useState(false);
  const [tweaking, setTweaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // The field being added (key null) or changed in the field sheet
  const [editingField, setEditingField] = useState<{ key: string | null } | null>(null);
  // The calculated field being added (key null) or changed
  const [editingCalculated, setEditingCalculated] = useState<{ key: string | null } | null>(null);
  // Set when saving is tried without a title, until one is typed
  const [titleMissing, setTitleMissing] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // A habit is uncategorized unless it's put in a category (or, for a new one, AI or the page it
    // was started from suggested one)
    if (!initialCategories) getCategories().then(setCategories);
    if (isOwner) isMqttConfigured().then(setMqttConfigured);
  }, [isOwner, initialCategories]);

  const draft: HabitDraft = {
    title: title.trim(),
    description: description.trim(),
    schema: { ...schema, title: title.trim(), enableVoice, enablePhoto },
    cadence,
    categoryId,
    publishToMqtt,
    aiContext,
    calculatedFields,
    reminder,
  };
  const dirty = comparable(draft) !== comparable(initial);
  const busy = saving || removing;
  const hasFields = Object.keys(schema.properties ?? {}).length > 0;
  const showSaveBar = mode === 'create' || dirty || saving;
  // Fields the habit had when the editor opened, which entries may already have values for
  const savedFieldKeys = mode === 'create' ? [] : Object.keys(initial.schema.properties ?? {});
  const calculatedKeys = calculatedFields.map(f => f.key);
  // Calculated fields can be made once the form has something to work them out from
  const canCalculate = Object.values(fieldsOf(schema)).some(isFormulaInput);
  const editingCalculatedField = editingCalculated?.key ? calculatedFields.find(f => f.key === editingCalculated.key) : undefined;
  // The calculated fields whose formula uses a form field, to warn before that field is changed or removed
  const calculatedUsing = (fieldKey: string) => calculatedFields.filter(field => {
    try {
      return fieldsUsed(parseExpression(field.expression)).includes(fieldKey);
    } catch {
      return false;
    }
  }).map(field => field.title);

  const handleTweak = async (change: string) => {
    setTweaking(true);
    const result = await generateHabitSchema(change, schema);
    setTweaking(false);
    if (!result.success) {
      toast.error(result.error || 'An error occurred');
      return false;
    }
    setSchema(prev => ({ ...prev, properties: result.schema?.properties, required: result.schema?.required }));
    toast.success('Form updated');
    return true;
  };

  const handleSave = async () => {
    if (!draft.title) {
      setTitleMissing(true);
      titleRef.current?.focus();
      toast.error('Give your habit a title');
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save habit');
      setSaving(false);
    }
  };

  const discard = () => {
    setTitle(initial.title);
    setDescription(initial.description);
    setSchema(initial.schema);
    setEnableVoice(voiceOn(initial.schema));
    setEnablePhoto(photoOn(initial.schema));
    setCadence(initial.cadence);
    setCategoryId(initial.categoryId);
    setPublishToMqtt(initial.publishToMqtt);
    setAiContext(initial.aiContext);
    setCalculatedFields(initial.calculatedFields);
    setReminder(initial.reminder);
    setResetKey(k => k + 1);
  };

  const handleRemove = async () => {
    if (!remove) return;
    setRemoving(true);
    try {
      await remove.onConfirm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
      setRemoving(false);
      setConfirmRemove(false);
    }
  };

  const aiSummary = [
    ...(isOwner && hasFields ? [`Voice ${enableVoice ? 'on' : 'off'}`, `Photo ${enablePhoto ? 'on' : 'off'}`] : []),
    aiContext.trim() ? 'Notes added' : 'No notes',
  ].join(' · ');

  return (
    <div key={resetKey} className={showSaveBar ? 'pb-20' : ''}>
      {/* Where it's filed and how often it's due, as pills that open a dialog to change them, like on
          the habit's page; here a change goes into the draft, saved with everything else */}
      <div className={`${PANE_INSET} py-4 flex flex-wrap items-center justify-center gap-2 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
        <CategoryQuickEdit
          categoryId={categoryId || null}
          categories={categories}
          onSave={async next => setCategoryId(next ?? '')}
          onCreated={created => setCategories(prev => [...prev, created])}
          saveLabel="Done"
        />
        <CadenceQuickEdit
          cadence={cadence}
          weekStartsOn={weekStartsOn}
          onSave={isOwner ? async next => setCadence(next) : undefined}
          lockedTitle="Set by the habit's owner"
          saveLabel="Done"
        />
      </div>

      {/* The habit's name and description */}
      <section>
        <PaneHeading>Habit</PaneHeading>
        <div className={`${PANE_SURFACE} ${PANE_INSET} py-4 space-y-2`}>
          {isOwner ? (
            <>
              <div className="relative">
                {/* Underlined while empty, so a new habit's blank title reads as something to fill in */}
                <input
                  ref={titleRef}
                  type="text"
                  className={`w-full text-2xl font-bold text-ink bg-transparent border-b focus:outline-none placeholder-ink-subtle pb-1 pr-8 transition-colors ${
                    titleMissing ? 'border-danger' : title ? 'border-transparent hover:border-line focus:border-focus' : 'border-line-strong focus:border-focus'
                  }`}
                  value={title}
                  placeholder="Habit title"
                  aria-label="Habit title"
                  maxLength={MAX_NAME_LENGTH}
                  aria-invalid={titleMissing}
                  onChange={e => {
                    setTitle(e.target.value);
                    if (e.target.value.trim()) setTitleMissing(false);
                    onChangeTitle?.(e.target.value);
                  }}
                  disabled={busy}
                />
                <Pencil className="w-5 h-5 text-ink-faint absolute right-1 top-2 pointer-events-none" />
              </div>
              {titleMissing && <p className="text-sm text-danger-ink">Give your habit a title to save it.</p>}
              <input
                type="text"
                className="w-full text-ink-secondary bg-transparent border-b border-transparent hover:border-line focus:border-focus focus:outline-none placeholder-ink-subtle pb-0.5 transition-colors"
                placeholder="Add a description"
                aria-label="Description"
                maxLength={MAX_DESCRIPTION_LENGTH}
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={busy}
              />
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-ink break-words">{initial.title}</h2>
              {initial.description && <p className="text-ink-secondary">{initial.description}</p>}
              <p className="text-sm text-ink-muted pt-1">
                Shared with you by <PersonLabel person={owner} size="sm" className="align-middle" />. Only they can change its name, form, and cadence.
              </p>
            </>
          )}
        </div>
      </section>

      {/* What an entry records */}
      <section>
        <PaneHeading action={<FormPreviewButton schema={schema} title={title} />}>What you record</PaneHeading>
        <div className={PANE_SURFACE}>
          <HabitFormOverview
            schema={schema}
            onEditField={isOwner && !busy && !tweaking ? key => setEditingField({ key }) : undefined}
            onAddField={isOwner && !busy && !tweaking ? () => setEditingField({ key: null }) : undefined}
          />
          {isOwner && (
            <div className={`${PANE_INSET} py-3 border-t border-line-subtle`}>
              <AiTweakInput onApply={handleTweak} applying={tweaking} disabled={busy} />
            </div>
          )}
        </div>
      </section>

      {/* Values worked out from each entry's fields, for charting */}
      {(calculatedFields.length > 0 || (isOwner && canCalculate)) && (
        <section>
          <PaneHeading>Calculated</PaneHeading>
          <div className={PANE_SURFACE}>
            <CalculatedFieldsOverview
              fields={calculatedFields}
              schema={schema}
              onEdit={isOwner && !busy && !tweaking ? key => setEditingCalculated({ key }) : undefined}
              onAdd={isOwner && canCalculate && !busy && !tweaking ? () => setEditingCalculated({ key: null }) : undefined}
            />
          </div>
        </section>
      )}

      {/* Settings rarely touched, folded away with a summary */}
      <PaneSection title="More settings">
        <CollapsibleSection title="AI logging" summary={aiSummary} defaultOpen={mode === 'shared'}>
          {isOwner && hasFields && (
            <>
              <Toggle
                bare
                icon={<Mic className="w-5 h-5" />}
                title="Voice Log"
                description="Fill in the form from what you say"
                checked={enableVoice}
                onChange={setEnableVoice}
                disabled={busy}
              />
              <Toggle
                bare
                icon={<Camera className="w-5 h-5" />}
                title="Photo Log"
                description="Fill in the form from a photo"
                color="blue"
                checked={enablePhoto}
                onChange={setEnablePhoto}
                disabled={busy}
              />
            </>
          )}
          <div className={`${PANE_INSET} py-3`}>
            <AiContextField value={aiContext} onChange={setAiContext} disabled={busy} />
          </div>
        </CollapsibleSection>

        {/* Only a habit with a cadence is ever due, so only one with a cadence can run late */}
        {reminder && reminderContext && cadence.type !== 'none' && (
          <CollapsibleSection title="Reminder" summary={reminderSummary(reminderContext.status, reminder, reminderContext.bedtime)}>
            <ReminderSettings
              status={reminderContext.status}
              draft={reminder}
              onChange={setReminder}
              bedtime={reminderContext.bedtime}
              hasDevice={reminderContext.hasDevice}
              disabled={busy}
            />
          </CollapsibleSection>
        )}

        {isOwner && mqttConfigured && (
          <CollapsibleSection title="Integrations" summary={publishToMqtt ? 'Publishing entries to Home Assistant' : 'None on'}>
            <Toggle
              bare
              icon={<Zap className="w-5 h-5" />}
              title="Home Assistant (MQTT)"
              description="Publish each entry to MQTT"
              color="amber"
              checked={publishToMqtt}
              onChange={setPublishToMqtt}
              disabled={busy}
            />
          </CollapsibleSection>
        )}
      </PaneSection>

      {remove && (
        <div className={`${PANE_INSET} py-6 flex justify-center`}>
          <Button variant="danger-ghost" onClick={() => setConfirmRemove(true)} disabled={busy}>
            {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : remove.icon}
            {remove.label}
          </Button>
        </div>
      )}

      {showSaveBar && (
        // Above the bottom nav, which is 4rem tall plus the safe area
        <div
          className="fixed inset-x-0 z-40 bg-surface/90 backdrop-blur-md border-t border-line animate-in slide-in-from-bottom-2 duration-200"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
          <div className="pane-inset py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">{saveBarExtra}</div>
            {mode !== 'create' && (
              <Button variant="ghost" onClick={discard} disabled={busy}>
                Discard
              </Button>
            )}
            <Button onClick={handleSave} disabled={busy || tweaking}>
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {mode === 'create' ? 'Create Habit' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}

      {editingField && (
        <FieldEditorSheet
          initial={editingField.key ? settingsOf(schema, editingField.key) : undefined}
          loggedBefore={!!editingField.key && savedFieldKeys.includes(editingField.key)}
          usedBy={editingField.key ? calculatedUsing(editingField.key) : []}
          onDone={settings => {
            setSchema(withField(schema, editingField.key, settings, calculatedKeys).schema);
            setEditingField(null);
          }}
          onRemove={editingField.key ? () => {
            setSchema(withoutField(schema, editingField.key!));
            setEditingField(null);
          } : undefined}
          onClose={() => setEditingField(null)}
        />
      )}

      {editingCalculated && (
        <CalculatedFieldSheet
          schema={schema}
          initial={editingCalculatedField}
          entries={entries}
          onDone={field => {
            setCalculatedFields(prev => editingCalculated.key
              ? prev.map(f => (f.key === editingCalculated.key ? { ...field, key: f.key } : f))
              : [...prev, { ...field, key: keyFor(field.title, [...Object.keys(fieldsOf(schema)), ...calculatedKeys]) }]);
            setEditingCalculated(null);
          }}
          onRemove={editingCalculated.key ? () => {
            setCalculatedFields(prev => prev.filter(f => f.key !== editingCalculated.key));
            setEditingCalculated(null);
          } : undefined}
          onClose={() => setEditingCalculated(null)}
        />
      )}

      {remove && (
        <ConfirmDialog
          isOpen={confirmRemove}
          title={remove.confirmTitle}
          message={remove.confirmMessage}
          confirmText={remove.confirmText}
          isProcessing={removing}
          onConfirm={handleRemove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  );
}
