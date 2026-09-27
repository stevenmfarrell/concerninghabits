'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BackButton() {
  const router = useRouter();

  return (
    <button 
      onClick={() => router.back()}
      className="p-2 -ml-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-colors shrink-0"
      title="Go Back"
    >
      <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
    </button>
  );
}
