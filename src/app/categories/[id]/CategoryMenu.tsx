'use client';

import { useState } from 'react';
import { MoreVertical, Link2, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function CategoryMenu() {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleCopyUrl = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    toast.success('URL copied to clipboard!');
  };

  return (
    <div className="relative z-10 shrink-0">
      <button 
        onClick={() => setMenuOpen(!menuOpen)}
        className="p-2 -mr-2 text-stone-500 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors relative z-20"
      >
        <MoreVertical className="w-6 h-6" />
      </button>
      
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-stone-100 py-2 z-50">
            <Link 
              href={`/settings/categories`}
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Manage Categories
            </Link>
            <button
              onClick={() => {
                handleCopyUrl();
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors text-left"
            >
              <Link2 className="w-4 h-4" />
              Copy URL
            </button>
          </div>
        </>
      )}
    </div>
  );
}
