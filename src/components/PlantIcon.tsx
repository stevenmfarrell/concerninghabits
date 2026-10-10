// The plant from public/plant-health.svg (the plant from plant-icon.svg without its ground, with its
// middle leaves repeated below them), always whole, with as many of its stages as `layers` says grown
// in the current text color, from the bottom up: 1 is its low leaves, 2 adds the middle leaves, 3 the
// bud on top; 0 for none, all of it faint (e.g. a habit with no cadence, which nothing's expected
// of). The rest are faint, still to grow: `ungrown` is their color, darker where the plant's on
// the stone rather than a white row. Sized by a height in `className`; it keeps the
// plant's shape. Its paths and viewBox are the SVG's; keep them in step if it changes.
const VIEW_BOX = { x: 277.5, y: 431, width: 46, height: 59.5 };

// The two middle leaves, which the low leaves repeat further down
const LEAVES = 'M2870 1463 c19 -7 43 -21 54 -31 25 -23 56 -90 56 -126 0 -27 -1 -28 -37 -21 -88 16 -163 96 -163 174 0 29 2 31 28 25 15 -4 43 -13 62 -21z M3230 1463 c-1 -37 -31 -103 -61 -130 -24 -22 -98 -53 -125 -53 -18 0 -18 51 0 93 18 44 54 74 112 97 66 26 74 25 74 -7z';
// A stage still to grow: the same gray as the empty days in a list row's calendar (see
// ActivityCalendar's `emptyColor` in its rows), so the two read as one thing, not yet done
const UNGROWN = 'text-surface-strong/70';

// The bud on top
const BUD = 'M3051 1615 c10 -22 19 -57 19 -78 0 -40 -28 -104 -55 -127 -13 -11 -18 -10 -30 6 -60 79 -60 162 -1 248 19 28 20 28 34 10 8 -11 23 -37 33 -59z';

export default function PlantIcon({ layers, className = '', ungrown = UNGROWN }: { layers: 0 | 1 | 2 | 3; className?: string; ungrown?: string }) {
  return (
    <svg
      viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`}
      className={`w-auto ${className}`}
      style={{ aspectRatio: VIEW_BOX.width / VIEW_BOX.height }}
      fill="currentColor"
      aria-hidden="true"
    >
      <g transform="translate(0,600) scale(0.1,-0.1)">
        <path fillRule="evenodd" transform="translate(0,-180)" d={LEAVES} className={layers >= 1 ? undefined : ungrown} />
        <path fillRule="evenodd" d={LEAVES} className={layers >= 2 ? undefined : ungrown} />
        <path fillRule="evenodd" d={BUD} className={layers >= 3 ? undefined : ungrown} />
      </g>
    </svg>
  );
}
