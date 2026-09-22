'use client';

import { useState, useEffect } from 'react';
import { generateHabitSchema } from '../../actions/habit';
import { updateHabit, getCategories, createCategory } from '../../actions/db';
import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Loader2, Sparkles, Save, ArrowLeft, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CategorySelect from '../../../components/CategorySelect';
import NewCategoryInline from '../../../components/NewCategoryInline';

export default function EditClient({ habit }: { habit: any }) {
  const router = useRouter();
  const [title, setTitle] = useState(habit.name);
  const [description, setDescription] = useState(habit.description || '');
  const [prompt, setPrompt] = useState(habit.prompt || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [schema, setSchema] = useState<any>(JSON.parse(habit.schema));
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState<string>(habit.categoryId || '');
  const [frequency, setFrequency] = useState<string>(habit.frequency || 'daily');
  
  // Custom category creation
  const [showNewCat, setShowNewCat] = useState(false);

  useEffect(() => {
    getCategories().then(cats => {
      setCategories(cats);
      if (cats.length > 0 && !categoryId) {
        setCategoryId(cats[0].id);
      }
    });
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setLoading(true);
    const result = await generateHabitSchema(prompt);
    if (result.success) {
      setSchema(result.schema);
      if (result.schema.title) {
        setTitle(result.schema.title);
      }
      if (result.category) {
        const match = categories.find(c => c.name.toLowerCase() === result.category?.toLowerCase());
        if (match) setCategoryId(match.id);
      }
    } else {
      alert(result.error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!schema) return;
    setSaving(true);
    const finalSchema = { ...schema, title };
    
    await updateHabit(habit.id, title, description, prompt, finalSchema, categoryId, frequency);
    router.push('/');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <Link href="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-slate-900">Edit Habit</h1>
          <p className="text-slate-600">Update your habit's details or ask AI to regenerate the tracking form.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Habit Name</label>
          <input 
            type="text" 
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Display Description (Optional)</label>
          <input 
            type="text" 
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="A short note about this habit for your dashboard..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
          />
        </div>

        <form onSubmit={handleGenerate} className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">AI Schema Prompt</label>
          <div className="flex flex-col sm:flex-row gap-4">
            <input 
              type="text" 
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading || saving}
              placeholder="e.g., Track my runs with distance and time..."
            />
            <button 
              type="submit" 
              disabled={loading || saving || !prompt.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Regenerate Schema
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 pb-4 border-b gap-4">
            <h2 className="text-2xl font-semibold">Form Preview</h2>
            <div className="flex flex-wrap items-center gap-3">
              {showNewCat ? (
                <div className="w-full sm:w-auto">
                  <NewCategoryInline 
                    onSave={async (name, icon) => {
                      const newCat = await createCategory(name, icon);
                      setCategories([...categories, newCat].sort((a, b) => a.name.localeCompare(b.name)));
                      setCategoryId(newCat.id);
                      setShowNewCat(false);
                    }} 
                    onCancel={() => setShowNewCat(false)} 
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <select
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    disabled={saving}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="multiple">Multiple / day</option>
                  </select>
                  <CategorySelect 
                    categories={categories}
                    value={categoryId}
                    onChange={setCategoryId}
                    onNew={() => setShowNewCat(true)}
                    disabled={saving || categories.length === 0}
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="prose max-w-none bg-slate-50 p-6 rounded-xl border border-slate-100">
            <Form 
              schema={{...schema, title: title}} 
              validator={validator} 
              onSubmit={(data) => alert(`This is just a preview. Save changes to use it!\n\nPayload: ${JSON.stringify(data.formData, null, 2)}`)}
              className="space-y-4 rjsf"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            onClick={handleSave}
            disabled={saving || showNewCat}
            className="px-8 py-4 bg-green-600 text-white rounded-xl font-medium text-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-3 disabled:opacity-70 shadow-sm w-full md:w-auto"
          >
            {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
