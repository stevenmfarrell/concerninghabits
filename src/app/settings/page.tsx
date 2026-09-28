import { getDefaultUser } from '../actions/db';
import Link from 'next/link';
import { ChevronRight, FolderTree, Users, Sliders, LogOut, KeyRound } from 'lucide-react';
import Icon from '../../components/Icon';
import { Button, LinkButton } from '../../components/ui/Button';

export default async function SettingsPage() {
  const user = await getDefaultUser();

  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-900">Settings</h1>
        </div>

        {/* Profile Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center shrink-0 border border-stone-200">
              <Icon name="User" className="w-8 h-8 text-stone-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900">{user.name}</h2>
              <p className="text-stone-500 text-sm">{user.email}</p>
              {user.isAdmin && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
                  Admin
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-col w-full sm:w-auto gap-2">
            <LinkButton href="/update-password" variant="outline" className="w-full sm:w-auto">
              <KeyRound className="w-4 h-4" /> Change Password
            </LinkButton>
            <form action={async () => {
              'use server';
              const { logout } = await import('../actions/auth');
              await logout();
            }}>
              <Button type="submit" variant="ghost" className="w-full sm:w-auto">
                <LogOut className="w-4 h-4" /> Log Out
              </Button>
            </form>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100">
          <Link href="/settings/preferences" className="flex items-center justify-between p-4 sm:p-6 hover:bg-stone-50 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                <Sliders className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-stone-800 text-lg">Personal Preferences</span>
                <span className="text-sm text-stone-500">Bedtime, calendar start day, emojis</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-stone-600 transition-colors" />
          </Link>

          <Link href="/settings/categories" className="flex items-center justify-between p-4 sm:p-6 hover:bg-stone-50 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                <FolderTree className="w-5 h-5" />
              </div>
              <span className="font-semibold text-stone-800 text-lg">Manage Categories</span>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-stone-600 transition-colors" />
          </Link>
          
          {user.isAdmin && (
            <Link href="/settings/users" className="flex items-center justify-between p-4 sm:p-6 hover:bg-stone-50 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-stone-800 text-lg">Family Users</span>
                  <span className="text-sm text-stone-500">Add or remove family members</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-stone-600 transition-colors" />
            </Link>
          )}
        </div>

      </div>
    </main>
  );
}
