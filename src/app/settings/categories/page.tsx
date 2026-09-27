import { getCategories } from '../../actions/db';
import CategoriesClient from './CategoriesClient';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function CategoriesSettingsPage() {
  const categories = await getCategories();
  
  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <Link href="/settings" className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Settings
          </Link>
          <h1 className="text-3xl font-bold text-stone-900">Categories</h1>
        </div>

        <CategoriesClient initialCategories={categories} />
      </div>
    </main>
  );
}
