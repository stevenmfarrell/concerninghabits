'use client';

import Select, { SelectOption } from './Select';
import Icon from './Icon';
import { Plus } from 'lucide-react';
import { orderCategoryTree } from '@/lib/categoryChoices';
import type { CategoryOption } from '@/lib/types';
import { UNCATEGORIZED_ICON } from '@/lib/constants';

interface CategorySelectProps {
  categories: CategoryOption[];
  value: string;
  onChange: (id: string) => void;
  onNew: () => void;
  disabled?: boolean;
}

export default function CategorySelect({ categories, value, onChange, onNew, disabled }: CategorySelectProps) {
  // Uncategorized (value ''), then top-level categories in their saved order, each followed by its
  // indented subcategories
  const options: SelectOption[] = [{ id: '', label: 'Uncategorized', icon: <Icon name={UNCATEGORIZED_ICON} className="w-4 h-4" /> }, ...orderCategoryTree(categories).map(({ category, depth, parent }) => ({
    id: category.id,
    label: category.name,
    selectedLabel: parent ? `${parent.name} › ${category.name}` : category.name,
    depth,
    icon: <Icon name={category.icon || 'List'} className="w-4 h-4" />
  }))];

  const footer = (
    <button
      type="button"
      onClick={onNew}
      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-accent-ink hover:bg-accent-soft transition-colors"
    >
      <Plus className="w-4 h-4" />
      <span className="font-medium">New Category</span>
    </button>
  );

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select Category"
      disabled={disabled}
      footer={footer}
      size="sm"
    />
  );
}
