'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, LayoutGrid, ListChecks, Settings } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  // Hide bottom nav on auth screens
  if (['/login', '/setup', '/update-password'].includes(pathname)) {
    return null;
  }

  const navItems = [
    { name: 'Due', href: '/', icon: ListChecks, matchPrefixes: [] },
    // A category's pages are reached from Habits
    { name: 'Habits', href: '/habits', icon: LayoutGrid, matchPrefixes: ['/habits', '/categories'] },
    { name: 'History', href: '/history', icon: CalendarDays, matchPrefixes: ['/history'] },
    { name: 'Settings', href: '/settings', icon: Settings, matchPrefixes: ['/settings'] },
  ];

  return (
    <>
      {/* Spacer to prevent content from hiding behind the fixed navbar */}
      <div className="h-20 shrink-0" /> 
      
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-t border-stone-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around items-center h-16 px-2 sm:px-4 max-w-md mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || item.matchPrefixes.some(prefix => pathname.startsWith(prefix));

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? 'text-emerald-600' : 'text-stone-400 hover:text-stone-600'
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
