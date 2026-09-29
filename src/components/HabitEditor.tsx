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
import toast from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';
import DurationWidget from './widgets/DurationWidget';
import UnitWidget from './widgets/UnitWidget';
import Select from './Select';
import { Button } from './ui/Button';
import { DEFAULT_TARGET_COUNT } from '@/lib/constants';
import type { CategoryOption, HabitSchema } from '@/lib/types';
import type { UiSchema } from '@rjsf/utils';

interface HabitEditorProps {
  initialTitle: string;
  initialDescription: string;
  initialSchema: HabitSchema;
  initialFrequency: string;
  initialCategoryId: string;
  initialPublishToMqtt?: boolean;
  isCreateMode?: boolean;
  onSave: (title: string, description: string, schema: HabitSchema, categoryId: string, frequency: string, publishToMqtt: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
  onChangeTitle?: (title: string) => void;
  // Added to the delete confirmation, e.g. to warn that a shared habit is deleted for everyone
  deleteWarning?: string;
}

export default function HabitEditor({
  initialTitle,
  initialDescription,
  initialSchema,
  initialFrequency,
  initialCategoryId,
  initialPublishToMqtt,
  isCreateMode,
  onSave,
  onDelete,
  onChangeTitle,
  deleteWarning
}: HabitEditorProps) {
  const [schema, setSchema] = useState<HabitSchema>(initialSchema);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [frequency, setFrequency] = useState<string>(initialFrequency);
  const [targetCount, setTargetCount] = useState<number>(initialSchema.targetCount || DEFAULT_TARGET_COUNT);
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId);
  const [publishToMqtt, setPublishToMqtt] = useState(initialPublishToMqtt || false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [enableVoice, setEnableVoice] = useState(initialSchema.enableVoice !== false);
  const [enablePhoto, setEnablePhoto] = useState(initialSchema.enablePhoto !== false);

  const [tweakPrompt, setTweakPrompt] = useState('');
  const [isTweaking, setIsTweaking] = useState(false);

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

  const handleTweakSchema = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tweakPrompt.trim() || !schema) return;

    setIsTweaking(true);
    const result = await generateHabitSchema(tweakPrompt, schema);
    if (result.success) {
      setSchema((prev) => ({
        ...prev,
        properties: result.schema?.properties,
        required: result.schema?.required,
      }));
      setTweakPrompt('');
    } else {
      toast.error(result.error || "An error occurred");
    }
    setIsTweaking(false);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (onChangeTitle) onChangeTitle(newTitle);
  };

  const handleSaveAction = async () => {
    if (!schema || !title) return;
    setSaving(true);
    const finalSchema = { ...schema, title, enableVoice, enablePhoto, targetCount: frequency === 'multiple' ? targetCount : undefined };
    try {
      await onSave(title, description, finalSchema, categoryId, frequency, publishToMqtt);
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
                const uiSchema: UiSchema = {};
                const properties = schema?.properties as Record<string, { 'x-widget'?: string; 'x-unit'?: string }> | undefined;
                if (properties) {
                  Object.keys(properties).forEach(key => {
                    const prop = properties[key];
                    if (prop['x-widget'] === 'duration') {
                      uiSchema[key] = { 'ui:widget': 'duration' };
                    } else if (prop['x-unit']) {
                      uiSchema[key] = { 'ui:widget': 'unit' };
                    }
                  });
                }
                return (
                  <Form
                    schema={{ ...schema, title: '' }}
                    uiSchema={uiSchema}
                    widgets={{ duration: DurationWidget, unit: UnitWidget }}
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
            <form onSubmit={handleTweakSchema} className="flex flex-col gap-3">
              <textarea
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px] resize-none text-sm"
                placeholder="e.g. 'Add a dropdown for mood', 'Make distance optional', 'Remove the whole form'"
                value={tweakPrompt}
                onChange={(e) => setTweakPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (tweakPrompt.trim() && !isTweaking && !saving) {
                      e.currentTarget.form?.requestSubmit();
                    }
                  }
                }}
                disabled={isTweaking || saving}
                autoComplete="off"
                data-1p-ignore
                enterKeyHint="send"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={isTweaking || saving || !tweakPrompt.trim()}
                className="self-end"
              >
                {isTweaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Apply AI Tweak
              </Button>
            </form>

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
                <Select
                  value={frequency}
                  onChange={setFrequency}
                  options={[
                    { id: 'daily', label: 'Daily' },
                    { id: 'weekly', label: 'Weekly' },
                    { id: 'monthly', label: 'Monthly' },
                    { id: 'multiple', label: 'Multiple times a day' }
                  ]}
                  disabled={saving}
                />
              </div>
            </div>

            {frequency === 'multiple' && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  Daily Target Count
                </label>
                <p className="text-xs text-stone-500 mb-2">
                  How many times per day saturates the calendar history?
                </p>
                <input
                  type="number"
                  min="1"
                  className="w-full sm:w-32 h-[42px] px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm"
                  value={targetCount}
                  onChange={(e) => setTargetCount(parseInt(e.target.value) || 1)}
                  disabled={saving}
                />
              </div>
            )}
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
