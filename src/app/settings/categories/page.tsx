import { getCategories } from '../../actions/db';
import CategoriesClient from './CategoriesClient';
import PageHeader from '@/components/PageHeader';
import { PanePage } from '@/components/Pane';

export default async function CategoriesSettingsPage() {
  const categories = await getCategories();

  return (
    <PanePage width="3xl" header={<PageHeader backHref="/settings" title="Manage Categories" />}>
      <CategoriesClient initialCategories={categories} />
    </PanePage>
  );
}
