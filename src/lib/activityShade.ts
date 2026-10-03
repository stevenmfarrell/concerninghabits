// Calendar colors: emerald for habits, blue for categories (so a category's combined calendar reads
// differently from a habit's). Class names are spelled out in full so Tailwind generates them.
export type ActivityColor = 'emerald' | 'blue';

export const ACTIVITY_PALETTES = {
  emerald: {
    // Shades for a multiple-times-a-day count, from a little to at-or-over target
    scale: ['bg-emerald-300', 'bg-emerald-400', 'bg-emerald-500', 'bg-emerald-600'],
    done: 'bg-emerald-500',
    periodDone: 'bg-emerald-200',
  },
  blue: {
    scale: ['bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-blue-600'],
    done: 'bg-blue-500',
    periodDone: 'bg-blue-200',
  },
} as const;

// The shade for a day on which `count` entries were logged against a target of `target` (a
// multiple-times-a-day habit, or a category's habits combined)
export function activityShade(count: number, target: number, color: ActivityColor = 'emerald') {
  const ratio = count / Math.max(target, 1);
  const [low, mid, high, full] = ACTIVITY_PALETTES[color].scale;
  return ratio >= 1 ? full : ratio >= 0.66 ? high : ratio >= 0.33 ? mid : low;
}
