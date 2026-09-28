'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TIMEZONE_COOKIE } from '@/lib/timezone';

// Reports the browser's time zone to the server in a cookie, so server-rendered dates and
// calendars use the viewer's day boundaries. Refreshes once when the time zone first appears or changes.
export default function TimeZoneSync() {
  const router = useRouter();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const current = document.cookie.split('; ').find(c => c.startsWith(`${TIMEZONE_COOKIE}=`))?.slice(TIMEZONE_COOKIE.length + 1);
    if (!timeZone || (current && decodeURIComponent(current) === timeZone)) return;

    document.cookie = `${TIMEZONE_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
