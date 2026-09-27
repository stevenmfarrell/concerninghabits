'use client';

import { useRouter } from 'next/navigation';

export default function HorizonToggle({ habitId, currentWeeks }: { habitId: string, currentWeeks: number }) {
  const router = useRouter();

  const handleToggle = (weeks: number) => {
    // Save preference in a cookie (expires in 1 year)
    document.cookie = `horizon_${habitId}=${weeks}; path=/; max-age=31536000`;
    router.replace(`/history/${habitId}?horizon=${weeks}`);
  };

  return (
    <div className="flex bg-stone-100 rounded-lg p-1">
      <button 
        onClick={() => handleToggle(5)}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${currentWeeks === 5 ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
      >
        1M
      </button>
      <button 
        onClick={() => handleToggle(26)}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${currentWeeks === 26 ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
      >
        6M
      </button>
      <button 
        onClick={() => handleToggle(52)}
        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${currentWeeks === 52 ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
      >
        1Y
      </button>
    </div>
  );
}
