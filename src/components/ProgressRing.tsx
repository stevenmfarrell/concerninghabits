import { Check } from 'lucide-react';

const FILL = { emerald: 'stroke-accent', blue: 'stroke-category' } as const;
const DONE = { emerald: 'bg-accent text-on-accent', blue: 'bg-category text-on-category' } as const;

// How far along something is, as a ring filling up around how many are done, e.g. "2" (of 3, which
// the ring's fill shows), for a habit (or, in blue, a category) that takes several entries a day,
// week, or month. Without `showCount` it's
// an empty circle until done, like a checkbox, for one done with a single entry. Once done it's a
// filled disc with a check. It's described for screen readers by whatever holds it (see LogRing).
export default function ProgressRing({ progress, showCount = true, size = 40, color = 'emerald' }: {
  progress: { done: number; needed: number };
  showCount?: boolean;
  size?: number;
  color?: keyof typeof FILL;
}) {
  const { done, needed } = progress;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = needed > 0 ? Math.min(done / needed, 1) : 0;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Starts at the top and fills clockwise */}
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-surface-strong" />
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
        className={`absolute inset-0 rounded-full flex items-center justify-center transition-[opacity,scale] duration-300 ${DONE[color]} ${fraction >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
        aria-hidden="true"
      >
        <Check className="w-5 h-5" strokeWidth={3} />
      </span>
      {showCount && fraction < 1 && (
        <span className="absolute text-sm leading-none font-semibold text-ink-secondary tabular-nums">{done}</span>
      )}
    </div>
  );
}
