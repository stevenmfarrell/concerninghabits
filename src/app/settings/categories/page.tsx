import { getCategories } from '../../actions/db';
import CategoriesClient from './CategoriesClient';
import PageHeader from '@/components/PageHeader';

export default async function CategoriesSettingsPage() {
  const categories = await getCategories();

  return (
    <main className="flex-1 bg-stone-50 font-sans flex flex-col h-full">
      <PageHeader backHref="/settings" title="Manage Categories" />

      {/* Content */}
      <div className="p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <CategoriesClient initialCategories={categories} />
        </div>
      </div>
    </main>
  );
}
