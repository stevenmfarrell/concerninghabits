import type { CadenceProgress } from '@/lib/cadence';

const FILL = { emerald: 'stroke-emerald-500', blue: 'stroke-blue-500' } as const;

// How far along something is, as a ring filling up around its count, e.g. "2/3", for a habit (or,
// in blue, a category) that takes several entries a day, week, or month. The period it's counted
// over is labeled under it, and it's described for screen readers, by RowStatus.
export default function ProgressRing({ progress, size = 36, color = 'emerald' }: { progress: CadenceProgress; size?: number; color?: keyof typeof FILL }) {
  const { done, needed } = progress;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = needed > 0 ? Math.min(done / needed, 1) : 0;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Starts at the top and fills clockwise */}
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-stone-200" />
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
      <span className="absolute text-[11px] font-semibold text-stone-700 tabular-nums">
        {done}/{needed}
      </span>
    </div>
  );
}
