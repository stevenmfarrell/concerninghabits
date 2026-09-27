import { getCategories } from '../../actions/db';
import CategoriesClient from './CategoriesClient';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function CategoriesSettingsPage() {
  const categories = await getCategories();
  
  return (
    <main className="flex-1 bg-stone-50 font-sans ">
      {/* Top Navbar */}
      <header className="bg-white border-b border-stone-200 px-4 h-14 flex items-center sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl w-full mx-auto flex items-center justify-center relative">
          <Link href="/settings" className="absolute left-0 p-2 -ml-2 rounded-full text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors" title="Back to Settings">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold text-stone-900">Manage Categories</h1>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <CategoriesClient initialCategories={categories} />
        </div>
      </div>
    </main>
  );
}
