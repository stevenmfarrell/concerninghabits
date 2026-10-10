'use client';

import { useState } from 'react';
import PlantIcon from './PlantIcon';
import { MenuBackdrop } from '@/components/ui/Menu';

// A habit's or category's plant at the top of its page (see HealthHeader), which says what it means
// on a tap, in a small tip under it (`tip`, e.g. "Habit health: 72%"); a tap anywhere else closes
// it. `description` is the fuller one for screen readers and a mouse's hover. Its leaves still to
// grow are darker than a row's (see PlantIcon), to show on the stone behind it.
export default function HealthTip({ layers, color, tip, description }: { layers: 0 | 1 | 2 | 3; color: string; tip: string; description: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex rounded-lg ${color} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
        title={open ? undefined : description}
        aria-label={description}
        aria-expanded={open}
      >
        <PlantIcon layers={layers} className="h-16" ungrown="text-ink-faint" />
      </button>
      {open && (
        <>
          <MenuBackdrop onClose={() => setOpen(false)} />
          <span role="status" className="absolute left-0 top-full mt-2 z-50 whitespace-nowrap rounded-lg bg-inverse text-on-inverse text-sm font-medium px-3 py-1.5 shadow-lg">
            {tip}
          </span>
        </>
      )}
    </span>
  );
}
