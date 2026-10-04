'use client';

import { useRouter, usePathname } from 'next/navigation';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

const HORIZONS = [
  { value: 5, label: '1M' },
  { value: 26, label: '6M' },
  { value: 52, label: '1Y' },
];

export default function HorizonToggle({ habitId, currentWeeks }: { habitId: string, currentWeeks: number }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleToggle = (weeks: number) => {
    // Save preference in a cookie (expires in 1 year)
    document.cookie = `horizon_${habitId}=${weeks}; path=/; max-age=31536000`;
    router.replace(`${pathname}?horizon=${weeks}`);
  };

  return <SegmentedControl label="Time range" options={HORIZONS} value={currentWeeks} onChange={handleToggle} />;
}
