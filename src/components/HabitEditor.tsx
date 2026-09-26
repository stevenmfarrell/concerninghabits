'use client';

import { useState, useEffect } from 'react';
import { generateHabitSchema } from '../app/actions/habit';
import { getCategories, createCategory } from '../app/actions/db';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Loader2, Save, Wand2, SquarePen, Trash2, Mic, Camera } from 'lucide-react';
import CategorySelect from './CategorySelect';
import NewCategoryInline from './NewCategoryInline';
import toast from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';
import DurationWidget from './widgets/DurationWidget';
import UnitWidget from './widgets/UnitWidget';

interface HabitEditorProps {
  initialTitle: string;
  initialDescription: string;
  initialSchema: any;
  initialFrequency: string;
  initialCategoryId: string;
  isCreateMode?: boolean;
  onSave: (title: string, description: string, schema: any, categoryId: string, frequency: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  onChangeTitle?: (title: string) => void;
}

export default function HabitEditor({
  initialTitle,
  initialDescription,
  initialSchema,
  initialFrequency,
  initialCategoryId,
  isCreateMode,
  onSave,
  onDelete,
  onChangeTitle
}: HabitEditorProps) {
  const [schema, setSchema] = useState<any>(initialSchema);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [frequency, setFrequency] = useState<string>(initialFrequency);
  const [frequencyDropdownOpen, setFrequencyDropdownOpen] = useState(false);
  const [targetCount, setTargetCount] = useState<number>(initialSchema.targetCount || 3);
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [enableVoice, setEnableVoice] = useState(initialSchema.enableVoice !== false);
  const [enablePhoto, setEnablePhoto] = useState(initialSchema.enablePhoto !== false);
  
  const [tweakPrompt, setTweakPrompt] = useState('');
  const [isTweaking, setIsTweaking] = useState(false);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [showNewCat, setShowNewCat] = useState(false);

  useEffect(() => {
    getCategories().then(cats => {
      setCategories(cats);
      if (cats.length > 0 && !categoryId) {
        setCategoryId(cats[0].id);
      }
    });
  }, []);

  const handleTweakSchema = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tweakPrompt.trim() || !schema) return;
    
    setIsTweaking(true);
    const result = await generateHabitSchema(tweakPrompt, schema);
    if (result.success) {
      setSchema((prev: any) => ({
        ...prev,
        properties: result.schema.properties,
        required: result.schema.required,
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
    await onSave(title, description, finalSchema, categoryId, frequency);
    // Component will typically unmount here due to navigation
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
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
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 mb-6">
                {(() => {
                  const uiSchema: any = {};
                  if (schema?.properties) {
                    Object.keys(schema.properties).forEach(key => {
                      const prop = schema.properties[key];
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
                      <button type="submit" className="mt-4 px-6 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors w-full">
                        Test Submit
                      </button>
                    </Form>
                  );
                })()}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:w-[180px]">
                  {showNewCat ? (
                    <NewCategoryInline
                      onSave={async (name, icon) => {
                        const newCat = await createCategory(name, icon);
                        setCategories([...categories, newCat].sort((a, b) => a.name.localeCompare(b.name)));
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
                  <div className="relative w-full">
                    <button 
                      type="button"
                      onClick={() => setFrequencyDropdownOpen(!frequencyDropdownOpen)}
                      className="w-full h-[42px] flex items-center justify-between px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left text-sm text-stone-900 shadow-sm"
                      disabled={saving}
                    >
                      {frequency === 'daily' ? 'Daily' : frequency === 'weekly' ? 'Weekly' : frequency === 'monthly' ? 'Monthly' : 'Multiple times a day'}
                      <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    {frequencyDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setFrequencyDropdownOpen(false)}></div>
                        <div className="absolute left-0 mt-2 w-full bg-white border border-stone-100 rounded-xl shadow-lg z-50 overflow-hidden py-1">
                          <button
                            type="button"
                            onClick={() => { setFrequency('daily'); setFrequencyDropdownOpen(false); }}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${frequency === 'daily' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'}`}
                          >
                            Daily
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFrequency('weekly'); setFrequencyDropdownOpen(false); }}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${frequency === 'weekly' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'}`}
                          >
                            Weekly
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFrequency('monthly'); setFrequencyDropdownOpen(false); }}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${frequency === 'monthly' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'}`}
                          >
                            Monthly
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFrequency('multiple'); setFrequencyDropdownOpen(false); }}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${frequency === 'multiple' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'}`}
                          >
                            Multiple times a day
                          </button>
                        </div>
                      </>
                    )}
                  </div>
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

          <div className="space-y-4">
            <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Tweak Form with AI</p>
            <form onSubmit={handleTweakSchema} className="flex flex-col gap-3">
              <textarea
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px] resize-none text-sm"
                placeholder="Missing a field? e.g. 'Add a dropdown for mood', 'Make distance optional'"
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
              <button 
                type="submit" 
                disabled={isTweaking || saving || !tweakPrompt.trim()}
                className="self-end px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isTweaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Apply AI Tweak
              </button>
            </form>

            <div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-sm mt-4 border border-blue-100">
              <strong>Tip:</strong> If your habit is as simple as "did I do it?", the generated form should be empty. Just clicking the submit button records the event.
            </div>

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
          </div>

        </div>
      </div>

      <div className={`flex flex-col-reverse md:flex-row ${onDelete ? 'justify-between' : 'justify-end'} items-center gap-4 pt-4`}>
        {onDelete && (
          <button 
            type="button"
            onClick={() => setShowConfirmDelete(true)}
            disabled={deleting || saving}
            className="px-6 py-4 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 w-full md:w-auto"
          >
            {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            Delete Habit
          </button>
        )}
        <button 
          onClick={handleSaveAction}
          disabled={saving || showNewCat || isTweaking || deleting}
          className="px-8 py-4 bg-emerald-600 text-white rounded-xl font-medium text-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-3 disabled:opacity-70 shadow-sm w-full md:w-auto"
        >
          {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
          {isCreateMode ? 'Looks Good, Create Habit' : 'Save Changes'}
        </button>
      </div>

      <ConfirmDialog
        isOpen={showConfirmDelete}
        title="Delete Habit"
        message={`Are you sure you want to delete "${title}"? This will permanently delete all of its history and logs.`}
        confirmText="Delete Habit"
        isProcessing={deleting}
        onConfirm={handleDeleteAction}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>
  );
}
