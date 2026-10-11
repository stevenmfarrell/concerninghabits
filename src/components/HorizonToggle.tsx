'use client';

import { useRouter, usePathname } from 'next/navigation';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { rememberPageView, type HorizonWeeks } from '@/lib/viewPrefs';

const HORIZONS: { value: HorizonWeeks; label: string }[] = [
  { value: 5, label: '1M' },
  { value: 26, label: '6M' },
  { value: 52, label: '1Y' },
];

// An activity calendar's time range, for a habit's or category's page (`pageId`), remembered for the
// next time it's opened (see viewPrefs) and put in the address bar
export default function HorizonToggle({ pageId, currentWeeks }: { pageId: string, currentWeeks: HorizonWeeks }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleToggle = (weeks: HorizonWeeks) => {
    rememberPageView(pageId, { horizon: weeks });
    router.replace(`${pathname}?horizon=${weeks}`);
  };

  return <SegmentedControl label="Time range" options={HORIZONS} value={currentWeeks} onChange={handleToggle} />;
}
