'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Camera, Loader2, Lock, Mic, Save, SquarePen, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { generateHabitSchema } from '../app/actions/habit';
import { getCategories, createCategory, isMqttConfigured } from '../app/actions/db';
import CategorySelect from './CategorySelect';
import NewCategoryInline from './NewCategoryInline';
import AiContextField from './AiContextField';
import AiTweakInput from './AiTweakInput';
import CollapsibleSection from './CollapsibleSection';
import ConfirmDialog from './ConfirmDialog';
import HabitFormOverview, { FormPreviewButton } from './HabitFormOverview';
import FieldEditorSheet from './FieldEditorSheet';
import PersonLabel from './PersonLabel';
import { Button } from './ui/Button';
import { Toggle } from './ui/Toggle';
import { CadencePicker, CadenceSettings } from './CadenceField';
import { describeCadence, type Cadence } from '@/lib/cadence';
import { settingsOf, withField, withoutField } from '@/lib/formFields';
import type { CategoryOption, HabitSchema } from '@/lib/types';
import type { Person } from '@/lib/userColors';

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
  onChangeTitle?: (title: string) => void;
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

// The habit editor, for creating, editing, and a shared habit's own settings, in the order things
// are most often changed: the habit's name, where it's filed and how often it's due, what its form
// records, then settings rarely touched, folded away with a summary. Changes are saved from a bar
// above the bottom nav, which shows once there's something to save.
export default function HabitEditor({ mode, initial, owner, onSave, remove, saveBarExtra, onChangeTitle }: HabitEditorProps) {
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
  // Bumped by Discard, to remount fields that keep their own state (e.g. a cadence's typed number)
  const [resetKey, setResetKey] = useState(0);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [showNewCat, setShowNewCat] = useState(false);
  const [mqttConfigured, setMqttConfigured] = useState(false);
  const [tweaking, setTweaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // The field being added (key null) or changed in the field sheet
  const [editingField, setEditingField] = useState<{ key: string | null } | null>(null);
  // Set when saving is tried without a title, until one is typed
  const [titleMissing, setTitleMissing] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // A habit is uncategorized unless it's put in a category (or, for a new one, AI or the page it
    // was started from suggested one)
    getCategories().then(setCategories);
    if (isOwner) isMqttConfigured().then(setMqttConfigured);
  }, [isOwner]);

  const draft: HabitDraft = {
    title: title.trim(),
    description: description.trim(),
    schema: { ...schema, title: title.trim(), enableVoice, enablePhoto },
    cadence,
    categoryId,
    publishToMqtt,
    aiContext,
  };
  const dirty = comparable(draft) !== comparable(initial);
  const busy = saving || removing;
  const hasFields = Object.keys(schema.properties ?? {}).length > 0;
  const showSaveBar = mode === 'create' || dirty || saving;
  // Fields the habit had when the editor opened, which entries may already have values for
  const savedFieldKeys = mode === 'create' ? [] : Object.keys(initial.schema.properties ?? {});

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
    setShowNewCat(false);
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
    <div key={resetKey} className={`space-y-4 sm:space-y-6 ${showSaveBar ? 'pb-24' : ''}`}>
      {/* The habit's name and description */}
      <section className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-stone-100 space-y-2">
        {isOwner ? (
          <>
            <div className="relative">
              {/* Underlined while empty, so a new habit's blank title reads as something to fill in */}
              <input
                ref={titleRef}
                type="text"
                className={`w-full text-2xl font-bold text-stone-900 bg-transparent border-b focus:outline-none placeholder-stone-400 pb-1 pr-8 transition-colors ${
                  titleMissing ? 'border-red-500' : title ? 'border-transparent hover:border-stone-200 focus:border-emerald-500' : 'border-stone-300 focus:border-emerald-500'
                }`}
                value={title}
                placeholder="Habit title"
                aria-label="Habit title"
                aria-invalid={titleMissing}
                onChange={e => {
                  setTitle(e.target.value);
                  if (e.target.value.trim()) setTitleMissing(false);
                  onChangeTitle?.(e.target.value);
                }}
                disabled={busy}
              />
              <SquarePen className="w-5 h-5 text-stone-300 absolute right-1 top-2 pointer-events-none" />
            </div>
            {titleMissing && <p className="text-sm text-red-600">Give your habit a title to save it.</p>}
            <input
              type="text"
              className="w-full text-stone-600 bg-transparent border-b border-transparent hover:border-stone-200 focus:border-emerald-500 focus:outline-none placeholder-stone-400 pb-0.5 transition-colors"
              placeholder="Add a description"
              aria-label="Description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={busy}
            />
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-stone-900 break-words">{initial.title}</h2>
            {initial.description && <p className="text-stone-600">{initial.description}</p>}
            <p className="text-sm text-stone-500 pt-1">
              Shared with you by <PersonLabel person={owner} size="sm" className="align-middle" />. Only they can change its name, form, and cadence.
            </p>
          </>
        )}
      </section>

      {/* Where it's filed, and how often it's due */}
      <section className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-stone-100 space-y-4">
        <SettingRow label="Category">
          {showNewCat ? (
            <NewCategoryInline
              onSave={async (name, icon) => {
                const newCat = await createCategory(name, icon);
                setCategories([...categories, newCat]);
                setCategoryId(newCat.id);
                setShowNewCat(false);
              }}
              onCancel={() => setShowNewCat(false)}
            />
          ) : (
            <CategorySelect
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              onNew={() => setShowNewCat(true)}
              disabled={busy}
            />
          )}
        </SettingRow>
        <SettingRow label="How often">
          {isOwner ? (
            <CadencePicker value={cadence} onChange={setCadence} disabled={busy} />
          ) : (
            <p className="h-[42px] flex items-center gap-2 px-3 text-sm text-stone-600 bg-stone-50 border border-stone-100 rounded-lg" title="Set by the habit's owner">
              {describeCadence(cadence)}
              <Lock className="w-3.5 h-3.5 text-stone-400" aria-label="Set by the habit's owner" />
            </p>
          )}
        </SettingRow>
        {isOwner && (
          <div className="sm:pl-28 -mt-2">
            <CadenceSettings value={cadence} onChange={setCadence} disabled={busy} />
          </div>
        )}
      </section>

      {/* What an entry records */}
      <section className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-stone-100 space-y-4">
        <div className="flex items-center justify-between gap-2 -my-1">
          <h2 className="font-semibold text-stone-800">What you record</h2>
          <FormPreviewButton schema={schema} title={title} />
        </div>
        <HabitFormOverview
          schema={schema}
          onEditField={isOwner && !busy && !tweaking ? key => setEditingField({ key }) : undefined}
          onAddField={isOwner && !busy && !tweaking ? () => setEditingField({ key: null }) : undefined}
        />
        {isOwner && <AiTweakInput onApply={handleTweak} applying={tweaking} disabled={busy} />}
      </section>

      <CollapsibleSection title="AI logging" summary={aiSummary} defaultOpen={mode === 'shared'}>
        {isOwner && hasFields && (
          <>
            <Toggle
              icon={<Mic className="w-5 h-5" />}
              title="Voice Log"
              description="Fill in the form from what you say"
              checked={enableVoice}
              onChange={setEnableVoice}
              disabled={busy}
            />
            <Toggle
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
        <AiContextField value={aiContext} onChange={setAiContext} disabled={busy} />
      </CollapsibleSection>

      {isOwner && mqttConfigured && (
        <CollapsibleSection title="Integrations" summary={publishToMqtt ? 'Publishing entries to Home Assistant' : 'None on'}>
          <Toggle
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

      {remove && (
        <div className="flex justify-center pt-4">
          <Button variant="danger-ghost" onClick={() => setConfirmRemove(true)} disabled={busy}>
            {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : remove.icon}
            {remove.label}
          </Button>
        </div>
      )}

      {showSaveBar && (
        // Above the bottom nav, which is 4rem tall plus the safe area
        <div
          className="fixed inset-x-0 z-40 bg-white/90 backdrop-blur-md border-t border-stone-200 animate-in slide-in-from-bottom-2 duration-200"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">{saveBarExtra}</div>
            {mode !== 'create' && (
              <Button variant="ghost" onClick={discard} disabled={busy}>
                Discard
              </Button>
            )}
            <Button onClick={handleSave} disabled={busy || showNewCat || tweaking}>
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
          onDone={settings => {
            setSchema(withField(schema, editingField.key, settings).schema);
            setEditingField(null);
          }}
          onRemove={editingField.key ? () => {
            setSchema(withoutField(schema, editingField.key!));
            setEditingField(null);
          } : undefined}
          onClose={() => setEditingField(null)}
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

// A setting as a row: its label beside its control, or above it on a phone
function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
      <span className="sm:w-24 shrink-0 text-sm font-medium text-stone-600">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
