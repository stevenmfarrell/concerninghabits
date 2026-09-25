import { getCategories } from '../../actions/db';
import CategoriesClient from './CategoriesClient';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import SettingsNav from '../SettingsNav';

export default async function CategoriesSettingsPage() {
  const categories = await getCategories();
  
  return (
    <main className="flex-1 p-4 sm:p-8 bg-stone-50 font-sans min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-stone-900">Settings</h1>
        </div>

        <SettingsNav currentTab="categories" />

        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-stone-100 space-y-6">
          <CategoriesClient initialCategories={categories} />
        </div>
      </div>
    </main>
  );
}
