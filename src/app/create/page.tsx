'use client';

import { use, useState } from 'react';
import { generateHabitSchema } from '../actions/habit';
import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import PageHeader from '@/components/PageHeader';
import { PANE_INSET, PANE_SURFACE, PaneHeading, PanePage } from '@/components/Pane';
import { Button } from '@/components/ui/Button';

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

  const buildManually = () => {
    sessionStorage.setItem('draftHabit', JSON.stringify({
      success: true,
      schema: { title: '', type: 'object', properties: {} },
      categoryId: category,
    }));
    router.push('/create/refine');
  };

  return (
    <PanePage width="3xl" header={<PageHeader title="New Habit" />}>
      <form onSubmit={handleGenerate}>
        <section>
          <PaneHeading>
            <label htmlFor="habit-prompt">What do you want to track?</label>
          </PaneHeading>
          <div className={`${PANE_SURFACE} ${PANE_INSET} py-4`}>
            <textarea
              id="habit-prompt"
              className="w-full px-4 py-3 bg-surface-subtle border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-focus min-h-[120px] resize-none"
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
        </section>
        <div className={`${PANE_INSET} py-4 flex flex-col sm:flex-row sm:justify-end gap-3`}>
          <Button type="submit" size="lg" disabled={loading || !initialPrompt.trim()} className="sm:order-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {loading ? 'Designing Habit...' : 'Generate with AI'}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={buildManually} disabled={loading} className="sm:order-1">
            Skip & Build Manually
          </Button>
        </div>
      </form>
    </PanePage>
  );
}
