'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { CalendarDays, LayoutGrid, ListChecks, Settings } from 'lucide-react';

// The app's tabs along the bottom of the screen. `status` sits centered just above it, e.g. whether
// there are changes waiting to sync (see SyncStatus).
export default function BottomNav({ status }: { status?: ReactNode }) {
  const pathname = usePathname();

  // Hide bottom nav on auth screens
  if (['/login', '/setup', '/update-password'].includes(pathname)) {
    return null;
  }

  const navItems = [
    { name: 'Agenda', href: '/', icon: ListChecks, matchPrefixes: [] },
    // A category's pages are reached from Habits
    { name: 'Habits', href: '/habits', icon: LayoutGrid, matchPrefixes: ['/habits', '/categories'] },
    { name: 'History', href: '/history', icon: CalendarDays, matchPrefixes: ['/history'] },
    { name: 'Settings', href: '/settings', icon: Settings, matchPrefixes: ['/settings'] },
  ];

  return (
    <>
      {/* Spacer to prevent content from hiding behind the fixed navbar */}
      <div className="h-20 shrink-0" /> 
      
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-t border-line" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {status && <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2">{status}</div>}
        <div className="flex justify-around items-center h-16 px-2 sm:px-4 max-w-md mx-auto">
          {navItems.map((item) => {
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
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? 'text-accent-ink' : 'text-ink-subtle hover:text-ink-secondary'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
