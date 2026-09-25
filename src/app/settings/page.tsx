import { getDefaultUser } from '../actions/db';
import Link from 'next/link';
import { ArrowLeft, User, List, Users } from 'lucide-react';
import PreferencesForm from './PreferencesForm';

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

        <div className="flex gap-4 border-b border-stone-200 pb-4 overflow-x-auto">
          <Link href="/settings" className="flex items-center gap-2 px-4 py-2 bg-stone-200 text-stone-800 rounded-lg font-medium whitespace-nowrap">
            <User className="w-4 h-4" /> Profile
          </Link>
          <Link href="/settings/categories" className="flex items-center gap-2 px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg font-medium whitespace-nowrap">
            <List className="w-4 h-4" /> Categories
          </Link>
          {user.isAdmin && (
            <Link href="/settings/users" className="flex items-center gap-2 px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg font-medium whitespace-nowrap">
              <Users className="w-4 h-4" /> Manage Users
            </Link>
          )}
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 space-y-6">
          <h2 className="text-xl font-bold text-stone-800 border-b pb-4">Personal Preferences</h2>
          
          <div className="max-w-md">
            <PreferencesForm initialBedtime={user.bedtime} initialWeekStartsOn={user.weekStartsOn} initialUseEmojiTitle={user.useEmojiTitle} />
          </div>
        </div>
      </div>
    </main>
  );
}
