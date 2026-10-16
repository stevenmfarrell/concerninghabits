'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { CalendarDays, LayoutGrid, ListChecks, Settings } from 'lucide-react';

// Where the tutorial puts its own quill, in place of the real one (see Tutorial), so it's taught where
// it is in the app
export const TUTORIAL_QUILL_SLOT = 'tutorial-quill';

// The app's tabs along the bottom of the screen, with `center` raised in the middle between them:
// the quill (see SmartEntry), within reach of a thumb on every page. `status` sits centered above
// it, e.g. whether there are changes waiting to sync (see SyncStatus).
export default function BottomNav({ status, center }: { status?: ReactNode; center?: ReactNode }) {
  const pathname = usePathname();

  // Hide bottom nav on auth screens
  if (['/login', '/setup', '/update-password'].includes(pathname)) {
    return null;
  }

  const tab = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const isActive = pathname === item.href || item.matchPrefixes.some(prefix => pathname.startsWith(prefix));
    return (
      // Prefetched in full, data and all, so tapping a tab shows it straight away rather than
      // its skeleton. Kept for five minutes (staleTimes); anything changed meanwhile clears it
      // (revalidatePath), as does coming back to the app after a while (see ResumeReload).
      <Link
        key={item.name}
        href={item.href}
        prefetch={true}
        className={`flex flex-col items-center justify-center h-full space-y-1 transition-colors ${
          isActive ? 'text-accent-ink' : 'text-ink-subtle hover:text-ink-secondary'
        }`}
      >
        <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
        <span className="text-[10px] font-medium">{item.name}</span>
      </Link>
    );
  };

  const navItems = [
    { name: 'Agenda', href: '/', icon: ListChecks, matchPrefixes: [] },
    // A category's pages are reached from Habits
    { name: 'Habits', href: '/habits', icon: LayoutGrid, matchPrefixes: ['/habits', '/categories'] },
    { name: 'History', href: '/history', icon: CalendarDays, matchPrefixes: ['/history'] },
    { name: 'Settings', href: '/settings', icon: Settings, matchPrefixes: ['/settings'] },
  ];

  return (
    <>
      {/* Spacer to prevent content from hiding behind the fixed navbar, and the quill rising out of it */}
      <div className="h-24 shrink-0" />
      
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-t border-line" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Above the quill, which rises out of the bar */}
        {status && <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-8">{status}</div>}
        <div className="grid grid-cols-5 items-center h-16 px-2 sm:px-4 max-w-md mx-auto">
          {navItems.slice(0, 2).map(tab)}
          {/* Raised out of the bar, half above it. The tutorial's quill goes here on its page. */}
          <div className="flex justify-center -mt-7">
            {pathname === '/tutorial' ? <div id={TUTORIAL_QUILL_SLOT} /> : center}
          </div>
          {navItems.slice(2).map(tab)}
        </div>
      </nav>
    </>
  );
}
