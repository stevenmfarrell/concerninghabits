import Link from 'next/link';
import { User, List, Users } from 'lucide-react';
import { getDefaultUser } from '../actions/db';

export default async function SettingsNav({ currentTab }: { currentTab: 'profile' | 'categories' | 'users' }) {
  const user = await getDefaultUser();

  return (
    <div className="flex gap-4 border-b border-stone-200 pb-4 overflow-x-auto">
      <Link 
        href="/settings" 
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap ${currentTab === 'profile' ? 'bg-stone-200 text-stone-800' : 'text-stone-600 hover:bg-stone-100'}`}
      >
        <User className="w-4 h-4" /> Profile
      </Link>
      <Link 
        href="/settings/categories" 
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap ${currentTab === 'categories' ? 'bg-stone-200 text-stone-800' : 'text-stone-600 hover:bg-stone-100'}`}
      >
        <List className="w-4 h-4" /> Categories
      </Link>
      {user.isAdmin && (
        <Link 
          href="/settings/users" 
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap ${currentTab === 'users' ? 'bg-stone-200 text-stone-800' : 'text-stone-600 hover:bg-stone-100'}`}
        >
          <Users className="w-4 h-4" /> Manage Users
        </Link>
      )}
    </div>
  );
}
