'use client';
import { useState } from 'react';
import { updateUserPreferences } from '../actions/db';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Select from '@/components/Select';

export default function PreferencesForm({ initialBedtime, initialWeekStartsOn, initialUseEmojiTitle, initialUnitSystem }: { initialBedtime: string, initialWeekStartsOn: string, initialUseEmojiTitle: boolean, initialUnitSystem: string }) {
  const [bedtime, setBedtime] = useState(initialBedtime || '01:00');
  const [weekStartsOn, setWeekStartsOn] = useState(initialWeekStartsOn || 'sunday');
  const [useEmojiTitle, setUseEmojiTitle] = useState(initialUseEmojiTitle ?? true);
  const [unitSystem, setUnitSystem] = useState(initialUnitSystem || 'imperial');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserPreferences({ bedtime, weekStartsOn, useEmojiTitle, unitSystem });
      router.refresh();
      toast.success("Settings saved!");
    } catch (err: any) {
      toast.error("Error saving settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = bedtime !== initialBedtime || weekStartsOn !== initialWeekStartsOn || useEmojiTitle !== initialUseEmojiTitle || unitSystem !== initialUnitSystem;

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-1">End of Day (Bedtime)</label>
        <p className="text-sm text-stone-500 mb-3">
          Events logged before this time will count towards the previous day. 
        </p>
        <input 
          type="time" 
          value={bedtime}
          onChange={e => setBedtime(e.target.value)}
          className="w-full sm:w-48 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-1">Week Starts On</label>
        <p className="text-sm text-stone-500 mb-3">
          Choose the first day of the week for calendars and weekly habit tracking.
        </p>
        <div className="relative w-full sm:w-48">
          <Select
            value={weekStartsOn}
            onChange={setWeekStartsOn}
            options={[
              { id: 'sunday', label: 'Sunday' },
              { id: 'monday', label: 'Monday' }
            ]}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-1">Unit System</label>
        <p className="text-sm text-stone-500 mb-3">
          Preferred measurement system. This is passed to AI tools when generating fields.
        </p>
        <div className="relative w-full sm:w-64">
          <Select
            value={unitSystem}
            onChange={setUnitSystem}
            options={[
              { id: 'imperial', label: 'Imperial (miles, lbs)' },
              { id: 'metric', label: 'Metric (km, kg)' }
            ]}
          />
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex items-center h-5 mt-0.5">
          <input
            id="useEmojiTitle"
            type="checkbox"
            checked={useEmojiTitle}
            onChange={e => setUseEmojiTitle(e.target.checked)}
            className="w-4 h-4 text-emerald-600 bg-stone-50 border-stone-300 rounded focus:ring-emerald-500"
          />
        </div>
        <div>
          <label htmlFor="useEmojiTitle" className="block text-sm font-semibold text-stone-700">
            Use Emoji in Habit Titles
          </label>
          <p className="text-sm text-stone-500 mt-1">
            When creating habits with AI, ask the AI to include a relevant emoji at the start of the title.
          </p>
        </div>
      </div>

      <button 
        type="submit" 
        disabled={saving || !hasChanges}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save
      </button>
    </form>
  );
}
