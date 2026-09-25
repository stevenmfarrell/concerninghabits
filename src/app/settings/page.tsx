import { getDefaultUser } from '../actions/db';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PreferencesForm from './PreferencesForm';
import SettingsNav from './SettingsNav';

export default async function SettingsPage() {
  const user = await getDefaultUser();

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-stone-900">Settings</h1>
        </div>

        <SettingsNav currentTab="profile" />

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 space-y-6">
          <h2 className="text-xl font-bold text-stone-800 border-b pb-4">Personal Preferences</h2>
          
          <div className="max-w-md">
            <PreferencesForm initialBedtime={user.bedtime} initialWeekStartsOn={user.weekStartsOn} initialUseEmojiTitle={user.useEmojiTitle} initialEmojiModifier={user.emojiModifier} />
          </div>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 space-y-6">
          <h2 className="text-xl font-bold text-stone-800 border-b pb-4">Account Security</h2>
          
          <div className="max-w-md">
            <Link 
              href="/update-password"
              className="inline-flex items-center justify-center px-4 py-2 border border-stone-200 rounded-xl text-sm font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 transition-colors"
            >
              Change Password
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
