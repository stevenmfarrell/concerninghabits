import { getCategories, getDefaultUser } from '../../actions/db';
import CategoriesClient from './CategoriesClient';
import Link from 'next/link';
import { Users } from 'lucide-react';

export default async function CategoriesSettingsPage() {
  const categories = await getCategories();
  const user = await getDefaultUser();
  
  return (
    <main className="min-h-screen p-8 bg-stone-50 font-sans">
      <div className="max-w-2xl mx-auto mb-6 flex justify-end">
        {user.isAdmin && (
          <Link 
            href="/settings/users"
            className="inline-flex items-center gap-2 px-4 py-2 bg-stone-200 text-stone-700 rounded-xl font-medium hover:bg-stone-300 transition-colors"
          >
            <Users className="w-4 h-4" />
            Manage Users
          </Link>
        )}
      </div>
      <CategoriesClient initialCategories={categories} />
    </main>
  );
}
