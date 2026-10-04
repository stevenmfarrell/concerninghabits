'use client';

import { useState } from 'react';
import { MoreVertical, Link2, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { IconButton } from '@/components/ui/IconButton';

import { ArrowUpDown } from 'lucide-react';
import { MENU_ITEM, MENU_PANEL, MenuBackdrop } from '@/components/ui/Menu';

export default function CategoryMenu({ categoryId }: { categoryId?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleCopyUrl = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    toast.success('URL copied to clipboard!');
  };

  return (
    <div className="relative z-10 shrink-0">
      <IconButton
        onClick={() => setMenuOpen(!menuOpen)}
        edge="right"
        className="relative z-20"
        title="More options"
      >
        <MoreVertical className="w-6 h-6" />
      </IconButton>
      
      {menuOpen && (
        <>
          <MenuBackdrop onClose={() => setMenuOpen(false)} />
          <div className={`${MENU_PANEL} absolute right-0 top-full mt-1 w-56`}>
            {categoryId && (
              <Link 
                href={`/categories/${categoryId}?reorder=true`}
                className={MENU_ITEM}
                onClick={() => setMenuOpen(false)}
              >
                <ArrowUpDown className="w-4 h-4" />
                Reorder
              </Link>
            )}
            <Link 
              href={`/settings/categories`}
              className={MENU_ITEM}
            >
              <Settings className="w-4 h-4" />
              Manage Categories
            </Link>
            <button
              onClick={() => {
                handleCopyUrl();
                setMenuOpen(false);
              }}
              className={MENU_ITEM}
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
