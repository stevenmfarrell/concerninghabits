'use client';
import { useState } from 'react';
import { updateUserPreferences } from '../actions/db';
import { Loader2, Save, Smile } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Select from '@/components/Select';
import { Button } from '@/components/ui/Button';
import { INPUT } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { PANE_INSET, PaneField, PaneSection } from '@/components/Pane';

export default function PreferencesForm({ initialBedtime, initialWeekStartsOn, initialUseEmojiTitle, initialUnitSystem, initialEmojiModifier }: { initialBedtime: string, initialWeekStartsOn: string, initialUseEmojiTitle: boolean, initialUnitSystem: string, initialEmojiModifier: string | null }) {
  const [bedtime, setBedtime] = useState(initialBedtime || '01:00');
  const [weekStartsOn, setWeekStartsOn] = useState(initialWeekStartsOn || 'sunday');
  const [useEmojiTitle, setUseEmojiTitle] = useState(initialUseEmojiTitle ?? true);
  const [emojiModifier, setEmojiModifier] = useState(initialEmojiModifier || '');
  const [unitSystem, setUnitSystem] = useState(initialUnitSystem || 'imperial');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserPreferences({ bedtime, weekStartsOn, useEmojiTitle, unitSystem, emojiModifier });
      router.refresh();
      toast.success("Settings saved!");
    } catch (err) {
      toast.error("Error saving settings: " + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = bedtime !== initialBedtime || weekStartsOn !== initialWeekStartsOn || useEmojiTitle !== initialUseEmojiTitle || unitSystem !== initialUnitSystem || emojiModifier !== (initialEmojiModifier || '');

  return (
    <form onSubmit={handleSave}>
      <PaneSection title="Calendar">
        <PaneField label="End of Day (Bedtime)" htmlFor="bedtime" description="Events logged before this time count towards the previous day.">
          <input
            id="bedtime"
            type="time"
            value={bedtime}
            onChange={e => setBedtime(e.target.value)}
            className={`${INPUT} sm:w-48`}
            required
          />
        </PaneField>
        <PaneField label="Week Starts On" description="The first day of the week for calendars and weekly habits.">
          <div className="w-full sm:w-48">
            <Select
              value={weekStartsOn}
              onChange={setWeekStartsOn}
              options={[
                { id: 'sunday', label: 'Sunday' },
                { id: 'monday', label: 'Monday' }
              ]}
            />
          </div>
        </PaneField>
      </PaneSection>

      <PaneSection title="AI">
        <PaneField label="Unit System" description="Your preferred measurements, passed to AI when it designs a habit's fields.">
          <div className="w-full sm:w-64">
            <Select
              value={unitSystem}
              onChange={setUnitSystem}
              options={[
                { id: 'imperial', label: 'Imperial (miles, lbs)' },
                { id: 'metric', label: 'Metric (km, kg)' }
              ]}
            />
          </div>
        </PaneField>
        <Toggle
          bare
          icon={<Smile className="w-5 h-5" />}
          title="Emoji in Habit Titles"
          description="When AI creates a habit, start its title with a fitting emoji"
          checked={useEmojiTitle}
          onChange={setUseEmojiTitle}
        />
        {useEmojiTitle && (
          <PaneField
            label="Emoji Style"
            htmlFor="emojiModifier"
            description={<>Ask AI for specific emoji styles, such as skin tone or gender (e.g. &quot;medium-light skin tone, female&quot;). Emoji are shown in black and white, so skin tones won&apos;t appear.</>}
          >
            <input
              id="emojiModifier"
              type="text"
              placeholder="e.g. female, light skin tone"
              value={emojiModifier}
              onChange={e => setEmojiModifier(e.target.value)}
              className={`${INPUT} sm:w-64`}
            />
          </PaneField>
        )}
      </PaneSection>

      <div className={`${PANE_INSET} py-4 flex justify-end`}>
        <Button type="submit" disabled={saving || !hasChanges}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </Button>
      </div>
    </form>
  );
}
