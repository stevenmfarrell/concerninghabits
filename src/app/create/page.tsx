'use client';

import { use, useState } from 'react';
import { generateHabitSchema } from '../actions/habit';
import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

// `?category=<id>` starts the new habit in that category (e.g. from an empty category's page),
// instead of the one the AI suggests
export default function CreateHabit({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = use(searchParams);
  const router = useRouter();
  const [initialPrompt, setInitialPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialPrompt.trim()) return;
    
    setLoading(true);
    const result = await generateHabitSchema(initialPrompt);
    if (result.success) {
      sessionStorage.setItem('draftHabit', JSON.stringify({ ...result, prompt: initialPrompt.trim(), ...(category ? { categoryId: category } : {}) }));
      router.push('/create/refine');
    } else {
      toast.error(result.error || "An error occurred");
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-stone-900">New Habit</h1>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
          <div>
            <label className="block text-stone-700 mb-2 font-medium">What do you want to track?</label>
            <textarea 
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[120px] resize-none"
              placeholder="e.g., Read 20 pages a day, track my morning run with distance and time, or drink 8 glasses of water..."
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (initialPrompt.trim() && !loading) {
                    e.currentTarget.form?.requestSubmit();
                  }
                }
              }}
              disabled={loading}
              autoFocus
              autoComplete="off"
              data-1p-ignore
              enterKeyHint="send"
            />
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 mt-2">
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('draftHabit', JSON.stringify({
                  success: true,
                  schema: { title: '', type: 'object', properties: {} },
                  categoryId: category,
                }));
                router.push('/create/refine');
              }}
              disabled={loading}
              className="px-6 py-3 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl font-medium transition-colors disabled:opacity-70 order-2 sm:order-1 text-center"
            >
              Skip & Build Manually
            </button>
            <button 
              type="submit" 
              disabled={loading || !initialPrompt.trim()}
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 order-1 sm:order-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              {loading ? 'Designing Habit...' : 'Generate with AI'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
