'use client';

import { useState, useEffect } from 'react';
import { generateHabitSchema } from '../app/actions/habit';
import { getCategories, createCategory, isMqttConfigured } from '../app/actions/db';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Loader2, Save, Wand2, SquarePen, Trash2, Mic, Camera } from 'lucide-react';
import CategorySelect from './CategorySelect';
import { orderCategoryTree } from '@/lib/categoryChoices';
import NewCategoryInline from './NewCategoryInline';
import AiContextField from './AiContextField';
import SpeakOrType, { type SpeakOrTypeStatus } from './SpeakOrType';
import toast from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';
import { HABIT_FORM_WIDGETS, habitFormUiSchema, type HabitFormProperties } from './widgets/habitForm';
import { Button } from './ui/Button';
import type { Cadence } from '@/lib/cadence';
import { CadencePicker, CadenceSettings } from './CadenceField';
import type { CategoryOption, HabitSchema } from '@/lib/types';

const TWEAK_EXAMPLES = [
  'Add a dropdown for mood',
  'Make distance optional',
  'Add a notes field',
  'Track time instead of reps',
  'Remove the whole form',
];

interface HabitEditorProps {
  initialTitle: string;
  initialDescription: string;
  initialSchema: HabitSchema;
  initialCadence: Cadence;
  initialCategoryId: string;
  initialPublishToMqtt?: boolean;
  initialAiContext?: string;
  isCreateMode?: boolean;
  onSave: (title: string, description: string, schema: HabitSchema, categoryId: string, cadence: Cadence, publishToMqtt: boolean, aiContext: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  onChangeTitle?: (title: string) => void;
  // Added to the delete confirmation, e.g. to warn that a shared habit is deleted for everyone
  deleteWarning?: string;
}

export default function HabitEditor({
  initialTitle,
  initialDescription,
  initialSchema,
  initialCadence,
  initialCategoryId,
  initialPublishToMqtt,
  initialAiContext,
  isCreateMode,
  onSave,
  onDelete,
  onChangeTitle,
  deleteWarning
}: HabitEditorProps) {
  const [schema, setSchema] = useState<HabitSchema>(initialSchema);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [cadence, setCadence] = useState<Cadence>(initialCadence);
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId);
  const [publishToMqtt, setPublishToMqtt] = useState(initialPublishToMqtt || false);
  const [aiContext, setAiContext] = useState(initialAiContext || '');
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [enableVoice, setEnableVoice] = useState(initialSchema.enableVoice !== false);
  const [enablePhoto, setEnablePhoto] = useState(initialSchema.enablePhoto !== false);

  // While an AI tweak is being applied: what's happening, and the requested change
  const [tweakStatus, setTweakStatus] = useState<SpeakOrTypeStatus>(null);
  const isTweaking = tweakStatus !== null;

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [showNewCat, setShowNewCat] = useState(false);
  const [mqttConfigured, setMqttConfigured] = useState(false);

  useEffect(() => {
    getCategories().then(cats => {
      setCategories(cats);
      setCategoryId(current =>
        // Default to the first category as shown in the dropdown
        cats.length > 0 && !cats.some(c => c.id === current) ? orderCategoryTree(cats)[0].category.id : current
      );
    });
    isMqttConfigured().then(setMqttConfigured);
  }, []);

  const handleTweakSchema = async (tweak: string) => {
    if (!schema) return;

    setTweakStatus({ message: 'Updating the form...', input: tweak });
    const result = await generateHabitSchema(tweak, schema);
    setTweakStatus(null);
    if (result.success) {
      setSchema((prev) => ({
        ...prev,
        properties: result.schema?.properties,
        required: result.schema?.required,
      }));
      toast.success('Form updated');
    } else {
      toast.error(result.error || "An error occurred");
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (onChangeTitle) onChangeTitle(newTitle);
  };

  const handleSaveAction = async () => {
    if (!schema || !title) return;
    setSaving(true);
    const finalSchema = { ...schema, title, enableVoice, enablePhoto };
    try {
      await onSave(title, description, finalSchema, categoryId, cadence, publishToMqtt, aiContext);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save habit');
      setSaving(false);
    }
  };

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleDeleteAction = async () => {
    if (onDelete) {
      setDeleting(true);
      try {
        await onDelete();
      } catch {
        setDeleting(false);
      }
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in zoom-in duration-300">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 space-y-6">
        <div className="flex justify-between items-center border-b pb-4">
          <h2 className="text-xl font-bold text-stone-800">{isCreateMode ? 'Draft Habit' : 'Habit Form'}</h2>
        </div>

        <div className="space-y-8">
          <div>
            <div className="mb-6">
              <div className="relative group flex items-center">
                <input
                  type="text"
                  className="text-2xl font-bold text-stone-900 bg-transparent border-b border-dashed border-stone-300 focus:outline-none focus:border-emerald-500 w-full placeholder-stone-300 pb-1 pr-8"
                  value={title}
                  placeholder="New Habit"
                  onChange={handleTitleChange}
                  disabled={saving}
                />
                <SquarePen className="w-5 h-5 text-stone-400 absolute right-1 top-2 pointer-events-none" />
              </div>
              {description !== '' ? (
                <div className="relative group flex items-center mt-2">
                  <input
                    type="text"
                    autoFocus={description === ' '}
                    className="w-full bg-transparent border-b border-dashed border-stone-300 focus:outline-none focus:border-emerald-500 text-stone-600 placeholder-stone-400 pb-0.5 pr-8"
                    placeholder="Why are you tracking this?"
                    value={description.trimStart()}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={saving}
                  />
                  <SquarePen className="w-4 h-4 text-stone-400 absolute right-1 top-1 pointer-events-none" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDescription(' ')}
                  className="mt-2 text-sm text-stone-400 hover:text-stone-600 transition-colors border-b border-dashed border-stone-300 pb-0.5 inline-flex items-center gap-1.5"
                >
                  [Add Description]
                  <SquarePen className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="mb-8">
              {(() => {
                const uiSchema = habitFormUiSchema(schema?.properties as HabitFormProperties | undefined);
                return (
                  <Form
                    schema={{ ...schema, title: '' }}
                    uiSchema={uiSchema}
                    widgets={HABIT_FORM_WIDGETS}
                    validator={validator}
                    onSubmit={() => toast.success('Form valid! (Test mode - nothing was saved)')}
                    className="rjsf rjsf-preview"
                  >
                    <Button type="submit" variant="secondary" size="lg" className="mt-4 w-full">
                      Test Submit
                    </Button>
                  </Form>
                );
              })()}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Tweak Form with AI</p>
            <p className="text-sm text-stone-500">Describe a change and AI will update the form above.</p>
            <SpeakOrType
              icon={<Wand2 className="w-4 h-4" />}
              label="Apply AI Tweak"
              ariaLabel={{ speak: 'Say a change to the form', type: 'Type a change to the form' }}
              variant="secondary"
              size="sm"
              disabled={saving}
              prompt={{
                listening: 'Listening...',
                typing: 'What should change?',
                hint: 'Describe how to change this habit\'s form.',
                placeholder: 'e.g. "Make distance optional"',
              }}
              examples={TWEAK_EXAMPLES}
              status={tweakStatus}
              onInput={handleTweakSchema}
            />

            {Object.keys(schema?.properties || {}).length > 0 && (
              <div className="mt-8 pt-6 border-t border-stone-100 space-y-4">
                <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">AI Input Methods</p>

                <label className="flex items-center justify-between p-4 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${enableVoice ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-200 text-stone-500'}`}>
                      <Mic className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-stone-900 text-sm">Voice Log</div>
                      <div className="text-xs text-stone-500">Extract fields from speech</div>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative ${enableVoice ? 'bg-emerald-500' : 'bg-stone-300'}`}>
                    <input type="checkbox" className="sr-only" checked={enableVoice} onChange={(e) => setEnableVoice(e.target.checked)} disabled={saving} />
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${enableVoice ? 'translate-x-7' : 'translate-x-1'}`} />
                  </div>
                </label>

                <label className="flex items-center justify-between p-4 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${enablePhoto ? 'bg-blue-100 text-blue-600' : 'bg-stone-200 text-stone-500'}`}>
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-stone-900 text-sm">Photo Log</div>
                      <div className="text-xs text-stone-500">Extract fields from images</div>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative ${enablePhoto ? 'bg-blue-500' : 'bg-stone-300'}`}>
                    <input type="checkbox" className="sr-only" checked={enablePhoto} onChange={(e) => setEnablePhoto(e.target.checked)} disabled={saving} />
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${enablePhoto ? 'translate-x-7' : 'translate-x-1'}`} />
                  </div>
                </label>
              </div>
            )}
            
            {mqttConfigured && (
              <div className="mt-8 pt-6 border-t border-stone-100 space-y-4">
                <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Integrations</p>
                <label className="flex items-center justify-between p-4 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${publishToMqtt ? 'bg-amber-100 text-amber-600' : 'bg-stone-200 text-stone-500'}`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-semibold text-stone-900 text-sm">Home Assistant (MQTT)</div>
                      <div className="text-xs text-stone-500">Publish log events to MQTT</div>
                    </div>
                  </div>
                  <div className={`w-12 h-6 rounded-full transition-colors relative ${publishToMqtt ? 'bg-amber-500' : 'bg-stone-300'}`}>
                    <input type="checkbox" className="sr-only" checked={publishToMqtt} onChange={(e) => setPublishToMqtt(e.target.checked)} disabled={saving} />
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${publishToMqtt ? 'translate-x-7' : 'translate-x-1'}`} />
                  </div>
                </label>
              </div>
            )}
          </div>



          <div className="pt-8 border-t border-stone-100">
            <AiContextField value={aiContext} onChange={setAiContext} disabled={saving} />
          </div>

          <div className="pt-8 border-t border-stone-100">
            <h3 className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-4">Organization & Cadence</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-[220px]">
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
                    disabled={saving || categories.length === 0}
                  />
                )}
              </div>

              <div className="w-full sm:flex-1">
                <CadencePicker value={cadence} onChange={setCadence} disabled={saving} />
              </div>
            </div>

            <CadenceSettings value={cadence} onChange={setCadence} disabled={saving} />
          </div>
        </div>
      </div>

      <div className={`flex flex-col-reverse md:flex-row ${onDelete ? 'justify-between' : 'justify-end'} items-center gap-4 pt-4`}>
        {onDelete && (
          <Button
            type="button"
            variant="danger-ghost"
            size="xl"
            onClick={() => setShowConfirmDelete(true)}
            disabled={deleting || saving}
            className="w-full md:w-auto"
          >
            {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            Delete Habit
          </Button>
        )}
        <Button
          variant="primary"
          size="xl"
          onClick={handleSaveAction}
          disabled={saving || showNewCat || isTweaking || deleting}
          className="w-full md:w-auto"
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
          {isCreateMode ? 'Looks Good, Create Habit' : 'Save Changes'}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={showConfirmDelete}
        title="Delete Habit"
        message={`Are you sure you want to delete "${title}"? This will permanently delete all of its history and logs.${deleteWarning ? ` ${deleteWarning}` : ''}`}
        confirmText="Delete Habit"
        isProcessing={deleting}
        onConfirm={handleDeleteAction}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>
  );
}
