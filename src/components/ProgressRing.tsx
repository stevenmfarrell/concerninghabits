// How far along something is, as a ring filling up around a count, e.g. "3/4", for a habit that
// takes several entries a day
export default function ProgressRing({ done, needed, size = 40 }: { done: number; needed: number; size?: number }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = needed > 0 ? Math.min(done / needed, 1) : 0;

  return (
    <div
      className="relative shrink-0 inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${done} of ${needed} done`}
      title={`${done} of ${needed} done`}
    >
      {/* Starts at the top and fills clockwise */}
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
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
          className="stroke-emerald-500 transition-[stroke-dashoffset] duration-500"
          // A round cap draws a dot even at zero length, so the arc is left out with nothing done
          visibility={done > 0 ? 'visible' : 'hidden'}
        />
      </svg>
      <span className="absolute text-[11px] font-semibold text-stone-700 tabular-nums" aria-hidden="true">
        {done}/{needed}
      </span>
    </div>
  );
}
