'use client';

import { useState, useEffect } from 'react';
import { generateHabitSchema } from '../../actions/habit';
import { saveHabit, getCategories, createCategory } from '../../actions/db';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Loader2, Save, ArrowLeft, Wand2, SquarePen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CategorySelect from '../../../components/CategorySelect';
import NewCategoryInline from '../../../components/NewCategoryInline';

export default function RefineHabit() {
  const router = useRouter();

  // Phase 2: Refinement State
  const [schema, setSchema] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<string>('daily');
  const [categoryId, setCategoryId] = useState<string>('');

  // Tweak Schema State
  const [tweakPrompt, setTweakPrompt] = useState('');
  const [isTweaking, setIsTweaking] = useState(false);

  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [showNewCat, setShowNewCat] = useState(false);

  useEffect(() => {
    // Load draft from session storage
    const draft = sessionStorage.getItem('draftHabit');
    if (!draft) {
      router.replace('/create');
      return;
    }

    try {
      const result = JSON.parse(draft);
      setSchema(result.schema);
      setTitle(result.schema.title || '');
      if (result.schema.frequency) setFrequency(result.schema.frequency);

      // Load categories
      getCategories().then(cats => {
        setCategories(cats);
        if (result.category) {
          const match = cats.find(c => c.name.toLowerCase() === result.category?.toLowerCase());
          if (match) {
            setCategoryId(match.id);
            return;
          }
        }
        if (cats.length > 0) setCategoryId(cats[0].id);
      });
    } catch (e) {
      router.replace('/create');
    }
  }, [router]);

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

      // Update session storage so refresh works
      const draft = JSON.parse(sessionStorage.getItem('draftHabit') || '{}');
      draft.schema = {
        ...draft.schema,
        properties: result.schema.properties,
        required: result.schema.required,
      };
      sessionStorage.setItem('draftHabit', JSON.stringify(draft));
    } else {
      alert(result.error);
    }
    setIsTweaking(false);
  };

  const handleSave = async () => {
    if (!schema || !title) return;
    setSaving(true);
    const finalSchema = { ...schema, title };
    await saveHabit(title, description, finalSchema, categoryId, frequency);
    sessionStorage.removeItem('draftHabit');
    router.push('/');
  };

  if (!schema) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <button onClick={() => router.push('/create')} className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Prompt
          </button>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-stone-900">Almost there...</h1>
            <p className="text-stone-600">Here is the draft we created. Make any updates and save when you're ready.</p>
          </div>
        </div>

        <div className="space-y-8 animate-in fade-in zoom-in duration-300">
          <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="text-xl font-bold text-stone-800">Habit Draft</h2>
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
                        onChange={(e) => {
                          setTitle(e.target.value);
                          const draft = JSON.parse(sessionStorage.getItem('draftHabit') || '{}');
                          if (draft.schema) draft.schema.title = e.target.value;
                          sessionStorage.setItem('draftHabit', JSON.stringify(draft));
                        }}
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
                    <Form
                      schema={{ ...schema, title: '' }}
                      validator={validator}
                      onSubmit={() => alert('This is just a preview!')}
                      className="rjsf rjsf-preview"
                    >
                      <button type="submit" className="mt-4 px-6 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors w-full">
                        Test Submit
                      </button>
                    </Form>
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
                      <select
                        className="w-full h-[42px] px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm"
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        disabled={saving}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="multiple">Multiple times a day</option>
                      </select>
                    </div>
                  </div>
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
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving || showNewCat || isTweaking}
              className="px-8 py-4 bg-emerald-600 text-white rounded-xl font-medium text-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-3 disabled:opacity-70 shadow-sm w-full md:w-auto"
            >
              {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
              Save Habit
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
