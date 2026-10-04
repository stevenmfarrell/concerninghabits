// Calendar colors: emerald for habits, blue for categories (so a category's combined calendar reads
// differently from a habit's). Class names are spelled out in full so Tailwind generates them.
export type ActivityColor = 'emerald' | 'blue';

export const ACTIVITY_PALETTES = {
  emerald: {
    // Shades for a multiple-times-a-day count, from a little to at-or-over target
    scale: ['bg-accent-scale-1', 'bg-accent-scale-2', 'bg-accent-scale-3', 'bg-accent-scale-4'],
    done: 'bg-accent-done',
    periodDone: 'bg-accent-period',
  },
  blue: {
    scale: ['bg-category-scale-1', 'bg-category-scale-2', 'bg-category-scale-3', 'bg-category-scale-4'],
    done: 'bg-category-done',
    periodDone: 'bg-category-period',
  },
} as const;

// The shade for a day on which `count` entries were logged against a target of `target` (a
// multiple-times-a-day habit, or a category's habits combined)
export function activityShade(count: number, target: number, color: ActivityColor = 'emerald') {
  const ratio = count / Math.max(target, 1);
  const [low, mid, high, full] = ACTIVITY_PALETTES[color].scale;
  return ratio >= 1 ? full : ratio >= 0.66 ? high : ratio >= 0.33 ? mid : low;
}
