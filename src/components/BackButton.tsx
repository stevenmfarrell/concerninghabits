'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { IconButton } from '@/components/ui/IconButton';

// Goes back to wherever the user came from. A page opened directly (a shortcut, a submit URL, a new
// tab) has nothing in the app to go back to, so it goes to `fallbackHref` instead.
export default function BackButton({ fallbackHref = '/' }: { fallbackHref?: string }) {
  const router = useRouter();

  return (
    <IconButton
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
      edge="left"
      title="Go Back"
    >
      <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
    </IconButton>
  );
}
