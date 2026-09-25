'use client';

import { useState } from 'react';
import { createCategory, updateCategory, deleteCategory } from '../../actions/db';
import Icon from '../../../components/Icon';
import IconPicker from '../../../components/IconPicker';
import NewCategoryInline from '../../../components/NewCategoryInline';
import { Plus, Trash2, Edit2, Check, X, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ConfirmDialog from '../../../components/ConfirmDialog';

export default function CategoriesClient({ initialCategories }: { initialCategories: any[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [loading, setLoading] = useState('');
  
  // New Category State
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('List');

  // Edit Category State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('List');

  const handleCreate = async (name: string, icon: string) => {
    const cat = await createCategory(name, icon);
    setCategories([...categories, cat].sort((a, b) => a.name.localeCompare(b.name)));
    setIsAdding(false);
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setLoading(id);
    const updated = await updateCategory(id, editName.trim(), editIcon);
    setCategories(categories.map(c => c.id === id ? updated : c).sort((a, b) => a.name.localeCompare(b.name)));
    setEditingId(null);
    setLoading('');
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    setLoading(deleteConfirmId);
    await deleteCategory(deleteConfirmId);
    setCategories(categories.filter(c => c.id !== deleteConfirmId));
    setLoading('');
    setDeleteConfirmId(null);
  };

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || 'List');
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center border-b pb-4">
          <h2 className="text-xl font-bold text-stone-800">Custom Categories</h2>
          <button 
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> New Category
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <ul className="divide-y divide-stone-100">
          {isAdding && (
            <li className="p-4 bg-stone-50 flex items-center gap-4">
              <NewCategoryInline onSave={handleCreate} onCancel={() => setIsAdding(false)} />
            </li>
          )}

          {categories.length === 0 && !isAdding ? (
            <li className="p-8 text-center text-stone-500">No categories found.</li>
          ) : (
            categories.map(cat => (
              <li key={cat.id} className="p-4 flex items-center gap-4 hover:bg-stone-50/50 transition-colors group">
                {editingId === cat.id ? (
                  <>
                    <div className="shrink-0">
                      <IconPicker value={editIcon} onChange={setEditIcon} />
                    </div>
                    <input 
                      type="text"
                      autoFocus
                      className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdate(cat.id)}
                    />
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleUpdate(cat.id)}
                        disabled={loading === cat.id || !editName.trim()}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {loading === cat.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                      </button>
                      <button 
                        onClick={() => setEditingId(null)}
                        className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Icon name={cat.icon || 'List'} className="w-5 h-5" />
                    </div>
                    <div className="flex-1 font-medium text-stone-800">
                      {cat.name}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEdit(cat)}
                        className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirmId(cat.id)}
                        disabled={loading === cat.id}
                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {loading === cat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))
          )}
        </ul>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        title="Delete Category"
        message='Are you sure you want to delete this category? Habits using it will be moved to "Other".'
        confirmText="Delete Category"
        isProcessing={!!(deleteConfirmId && loading === deleteConfirmId)}
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
