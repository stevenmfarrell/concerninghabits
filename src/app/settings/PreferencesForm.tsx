'use client';
import { useState } from 'react';
import { updateUserPreferences } from '../actions/db';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function PreferencesForm({ initialBedtime, initialWeekStartsOn, initialUseEmojiTitle, initialEmojiModifier, initialUnitSystem }: { initialBedtime: string, initialWeekStartsOn: string, initialUseEmojiTitle: boolean, initialEmojiModifier: string, initialUnitSystem: string }) {
  const [bedtime, setBedtime] = useState(initialBedtime || '01:00');
  const [weekStartsOn, setWeekStartsOn] = useState(initialWeekStartsOn || 'sunday');
  const [useEmojiTitle, setUseEmojiTitle] = useState(initialUseEmojiTitle ?? true);
  const [emojiModifier, setEmojiModifier] = useState(initialEmojiModifier || '');
  const [unitSystem, setUnitSystem] = useState(initialUnitSystem || 'imperial');
  const [saving, setSaving] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'week' | 'unit' | null>(null);
  const router = useRouter();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserPreferences({ bedtime, weekStartsOn, useEmojiTitle, emojiModifier, unitSystem });
      router.refresh();
      toast.success("Settings saved!");
    } catch (err: any) {
      toast.error("Error saving settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = bedtime !== initialBedtime || weekStartsOn !== initialWeekStartsOn || useEmojiTitle !== initialUseEmojiTitle || emojiModifier !== initialEmojiModifier || unitSystem !== initialUnitSystem;

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
          <button 
            type="button"
            onClick={() => setOpenDropdown(openDropdown === 'week' ? null : 'week')}
            className="w-full flex items-center justify-between px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left text-stone-900 font-medium"
          >
            {weekStartsOn === 'sunday' ? 'Sunday' : 'Monday'}
            <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          {openDropdown === 'week' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
              <div className="absolute left-0 mt-2 w-full bg-white border border-stone-100 rounded-xl shadow-lg z-50 overflow-hidden py-1">
                <button
                  type="button"
                  onClick={() => { setWeekStartsOn('sunday'); setOpenDropdown(null); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${weekStartsOn === 'sunday' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'}`}
                >
                  Sunday
                </button>
                <button
                  type="button"
                  onClick={() => { setWeekStartsOn('monday'); setOpenDropdown(null); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${weekStartsOn === 'monday' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'}`}
                >
                  Monday
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-1">Unit System</label>
        <p className="text-sm text-stone-500 mb-3">
          Preferred measurement system. This is passed to AI tools when generating fields.
        </p>
        <div className="relative w-full sm:w-64">
          <button 
            type="button"
            onClick={() => setOpenDropdown(openDropdown === 'unit' ? null : 'unit')}
            className="w-full flex items-center justify-between px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left text-stone-900 font-medium"
          >
            {unitSystem === 'imperial' ? 'Imperial (miles, lbs)' : 'Metric (km, kg)'}
            <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          {openDropdown === 'unit' && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)}></div>
              <div className="absolute left-0 mt-2 w-full bg-white border border-stone-100 rounded-xl shadow-lg z-50 overflow-hidden py-1">
                <button
                  type="button"
                  onClick={() => { setUnitSystem('imperial'); setOpenDropdown(null); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${unitSystem === 'imperial' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'}`}
                >
                  Imperial (miles, lbs)
                </button>
                <button
                  type="button"
                  onClick={() => { setUnitSystem('metric'); setOpenDropdown(null); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${unitSystem === 'metric' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-stone-700 hover:bg-stone-50'}`}
                >
                  Metric (km, kg)
                </button>
              </div>
            </>
          )}
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

      {useEmojiTitle && (
        <div className="pl-7 animate-in fade-in slide-in-from-top-2">
          <label className="block text-sm font-semibold text-stone-700 mb-1">Emoji Style / Modifiers (Optional)</label>
          <p className="text-sm text-stone-500 mb-3">
            Specify preferred skin tone, gender, or theme (e.g. "female, medium skin tone").
          </p>
          <input 
            type="text" 
            value={emojiModifier}
            onChange={e => setEmojiModifier(e.target.value)}
            className="w-full sm:w-64 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            placeholder="e.g. female, medium skin tone"
          />
        </div>
      )}

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
