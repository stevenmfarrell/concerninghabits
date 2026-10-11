import { Check } from 'lucide-react';

const FILL = { emerald: 'stroke-accent', blue: 'stroke-category', warning: 'stroke-warning' } as const;
// The ring's empty track, over a pale fill of the same hue, so it reads as a button rather than a
// chart, deepening on hover when it's in a button (`group/ring`, see LogRing). Lighter on the light
// theme, where a column of them is otherwise loud; the dark theme's tints are subdued already.
const TRACK = {
  emerald: 'stroke-accent-line fill-accent-soft/50 dark:stroke-accent-line-strong dark:fill-accent-soft pointer-fine:group-hover/ring:fill-accent-soft-strong',
  blue: 'stroke-category-soft-strong fill-category-soft/50 dark:stroke-category-line dark:fill-category-soft pointer-fine:group-hover/ring:fill-category-soft-strong',
  warning: 'stroke-warning-soft-strong fill-warning-soft pointer-fine:group-hover/ring:fill-warning-soft-strong',
} as const;
const DONE = { emerald: 'bg-accent text-on-accent', blue: 'bg-category text-on-category', warning: '' } as const;

// How far along something is, as a ring filling up around how many are done, e.g. "2" (of 3, which
// the ring's fill shows), for a habit (or, in blue, a category) that takes several entries a day,
// week, or month, or an empty circle before the first. Without `showCount` it's an empty circle until
// done, like a checkbox, for one done with a single entry. Once done it's a filled disc with a
// check. It's described for screen readers by whatever holds it (see LogRing).
//
// With `limit`, it's how much of a limit is used instead (`needed` being the most allowed): it fills
// toward it, full at the limit with no check (reaching it isn't an achievement), and turns amber once
// over it, with how many so far. With a limit of 0, any entry at all is over.
export default function ProgressRing({ progress, showCount = true, size = 40, color: baseColor = 'emerald', limit = false }: {
  progress: { done: number; needed: number };
  showCount?: boolean;
  size?: number;
  color?: keyof typeof FILL;
  limit?: boolean;
}) {
  const { done, needed } = progress;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const over = limit && done > needed;
  const color = over ? 'warning' : baseColor;
  const fraction = needed > 0 ? Math.min(done / needed, 1) : over ? 1 : 0;
  // A limit's never done, so it never shows the done disc
  const showsDone = !limit && fraction >= 1;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Starts at the top and fills clockwise */}
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className={`${TRACK[color]} transition-[fill]`} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={`${FILL[color]} transition-[stroke-dashoffset] duration-500`}
          // A round cap draws a dot even at zero length, so the arc is left out with nothing done
          visibility={done > 0 ? 'visible' : 'hidden'}
        />
      </svg>
      {/* Done: the disc fills in over the full ring */}
      <span
        className={`absolute inset-0 rounded-full flex items-center justify-center transition-[opacity,scale] duration-300 ${DONE[color]} ${showsDone ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
        aria-hidden="true"
      >
        <Check className="w-5 h-5" strokeWidth={3} />
      </span>
      {showCount && done > 0 && !showsDone && (
        <span className={`absolute text-sm leading-none font-semibold tabular-nums ${over ? 'text-warning-ink-strong' : 'text-ink-secondary'}`}>{done}</span>
      )}
    </div>
  );
}
