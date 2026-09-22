import { getCategories } from '../../actions/db';
import CategoriesClient from './CategoriesClient';

export default async function CategoriesSettingsPage() {
  const categories = await getCategories();
  
  return (
    <main className="min-h-screen p-8 bg-slate-50 font-sans">
      <CategoriesClient initialCategories={categories} />
    </main>
  );
}
