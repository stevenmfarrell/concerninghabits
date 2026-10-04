import { getDefaultUser } from '@/app/actions/db';
import PageHeader from '@/components/PageHeader';
import { PanePage, PaneSection } from '@/components/Pane';
import PreferencesForm from '../PreferencesForm';
import ThemePicker from '../ThemePicker';

export default async function PreferencesPage() {
  const user = await getDefaultUser();

  return (
    <PanePage width="3xl" header={<PageHeader title="Preferences" backHref="/settings" />}>
      <PaneSection title="Appearance">
        <ThemePicker />
      </PaneSection>
      <PreferencesForm
        initialBedtime={user.bedtime}
        initialWeekStartsOn={user.weekStartsOn}
        initialUseEmojiTitle={user.useEmojiTitle}
        initialEmojiModifier={user.emojiModifier}
        initialUnitSystem={user.unitSystem}
      />
    </PanePage>
  );
}
