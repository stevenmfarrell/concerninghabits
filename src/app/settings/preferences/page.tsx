import { getDefaultUser } from '@/app/actions/db';
import BackLink from '@/components/BackLink';
import PreferencesForm from '../PreferencesForm';

export default async function PreferencesPage() {
  const user = await getDefaultUser();

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <BackLink href="/settings">Settings</BackLink>
          <h1 className="text-3xl font-bold text-stone-900">Personal Preferences</h1>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 space-y-6">
          <div className="max-w-md">
            <PreferencesForm 
              initialBedtime={user.bedtime} 
              initialWeekStartsOn={user.weekStartsOn} 
              initialUseEmojiTitle={user.useEmojiTitle} initialEmojiModifier={user.emojiModifier} 
               
              initialUnitSystem={user.unitSystem}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
