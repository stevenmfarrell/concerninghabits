'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { IconButton } from '@/components/ui/IconButton';

export default function BackButton() {
  const router = useRouter();

  return (
    <IconButton onClick={() => router.back()} edge="left" title="Go Back">
      <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
    </IconButton>
  );
}
