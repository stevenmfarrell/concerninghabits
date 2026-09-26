'use client';

import ActivityCalendar from '../../../components/ActivityCalendar';
import { useRouter, useSearchParams } from 'next/navigation';

export default function InteractiveCalendar(props: {
  logs: { id: string; createdAt: Date }[];
  weeks: number;
  frequency: string;
  targetCount: number;
  mobileMonthsPerColumn: number;
  desktopMonthsPerColumn: number;
  bedtime: string;
  weekStartsOn: string;
  pageSize: number;
  habitId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDateClick = (clickedDate: Date) => {
    // End of clicked day to safely catch any logs that occurred on that day
    const targetTime = new Date(clickedDate);
    targetTime.setHours(23, 59, 59, 999);
    
    // Find the first log that occurred on or before the clicked date (since dates are sorted DESC)
    const index = props.logs.findIndex(l => new Date(l.createdAt).getTime() <= targetTime.getTime());
    
    // If not found, it means the clicked date is older than our oldest log, so we jump to the last page
    const page = index !== -1 ? Math.floor(index / props.pageSize) + 1 : Math.max(1, Math.ceil(props.logs.length / props.pageSize));
    const highlightId = index !== -1 ? props.logs[index].id : null;
    
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    if (highlightId) {
      params.set('highlight', highlightId);
      params.set('t', Date.now().toString());
    } else {
      params.delete('highlight');
      params.delete('t');
    }
    
    router.push(`/history/${props.habitId}?${params.toString()}`, { scroll: false });
    
    // Smoothly glide down to the target log (or the table if no log)
    setTimeout(() => {
      const targetElement = highlightId ? document.getElementById(`log-${highlightId}`) : document.getElementById('logs-table');
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150); // slight delay to allow Next.js to render the new page
  };

  return (
    <>
      <div className={`hidden sm:flex w-full ${props.weeks === 5 ? 'justify-center' : 'justify-center sm:justify-start'}`}>
        <ActivityCalendar dates={props.logs.map(l => l.createdAt)} weeks={props.weeks} frequency={props.frequency} targetCount={props.targetCount} size="md" monthsPerColumn={props.desktopMonthsPerColumn} bedtime={props.bedtime} weekStartsOn={props.weekStartsOn} onDateClick={handleDateClick} />
      </div>
      <div className={`flex sm:hidden w-full ${props.weeks === 5 ? 'justify-center' : 'justify-start'}`}>
        <ActivityCalendar dates={props.logs.map(l => l.createdAt)} weeks={props.weeks} frequency={props.frequency} targetCount={props.targetCount} size="md" monthsPerColumn={props.mobileMonthsPerColumn} bedtime={props.bedtime} weekStartsOn={props.weekStartsOn} onDateClick={handleDateClick} />
      </div>
    </>
  );
}
