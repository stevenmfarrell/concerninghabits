'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FolderTree, MoreVertical } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { MENU_ITEM, MENU_PANEL, MenuBackdrop } from '@/components/ui/Menu';

// The Habits page header's kebab menu, for what's done less often than browsing and logging
export default function HabitsMenu() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <IconButton onClick={() => setMenuOpen(!menuOpen)} edge="right" title="More options" aria-label="More options" aria-expanded={menuOpen}>
        <MoreVertical className="w-6 h-6" />
      </IconButton>
      {menuOpen && (
        <>
          <MenuBackdrop onClose={() => setMenuOpen(false)} />
          <div className={`${MENU_PANEL} absolute right-0 top-full mt-1 w-56`}>
            <Link href="/settings/categories" className={MENU_ITEM} onClick={() => setMenuOpen(false)}>
              <FolderTree className="w-4 h-4" />
              Manage Categories
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
