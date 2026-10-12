import type { ReactNode } from 'react';
import PlantIcon from './PlantIcon';
import HealthTip from './HealthTip';
import { CONSISTENCY_LABELS, type Consistency, type ConsistencyLevel } from '@/lib/consistency';

// Each level's plant (see PlantIcon) and color: the whole plant grown for thriving, its two pairs of
// leaves for taking root, just its low leaves (in amber) for needing care; the rest of it is faint,
// still to grow. Freshly planted is all faint, as for no cadence: there's nothing to say yet.
const LEVELS: Record<ConsistencyLevel, { layers: 0 | 1 | 2 | 3; color: string }> = {
  thriving: { layers: 3, color: 'text-accent-ink' },
  takingRoot: { layers: 2, color: 'text-accent-ink' },
  needsCare: { layers: 1, color: 'text-warning-ink' },
  freshlyPlanted: { layers: 0, color: '' },
};

// What a plant that's all gray means: there's no cadence, so nothing's expected of it
const NO_CADENCE = 'No cadence, so no health to show';

// What its hover title says: the level, how consistent that is, and which way it's going
function describe({ level, score, trend }: Consistency) {
  if (score === null) return `${CONSISTENCY_LABELS[level]}: too soon to say how consistent it is`;
  const direction = trend === 'up' ? ', and improving' : trend === 'down' ? ', and slipping' : '';
  return `${CONSISTENCY_LABELS[level]}: ${Math.round(score * 100)}% consistent lately${direction}`;
}

// The top of a habit's or category's page, under its name: how consistently it's been kept up lately
// (see consistency) as its plant, large, at the start, and its pills beside it in two rows, `top`
// (e.g. its category) over `bottom` (e.g. its cadence and skipping it). One with no cadence
// (`consistency` null), or freshly planted, has the plant all gray. A tap on the plant says what it
// means (e.g. "Habit health: 72%", for `noun` "Habit";
// see HealthTip), so it isn't another number or word to chase until it's asked for. `onOpenTip`
// hears about that tap.
export default function HealthHeader({ consistency, noun, top, bottom, onOpenTip }: { consistency: Consistency | null; noun: 'Habit' | 'Category'; top?: ReactNode; bottom: ReactNode; onOpenTip?: () => void }) {
  const level = consistency ? LEVELS[consistency.level] : null;
  return (
    <div className="flex items-center gap-6">
      {!consistency || !level ? (
        <HealthTip layers={0} color="" tip={`${noun} health: no cadence`} description={NO_CADENCE} onOpen={onOpenTip} />
      ) : (
        <HealthTip
          layers={level.layers}
          color={level.color}
          tip={`${noun} health: ${consistency.score === null ? 'too soon to tell' : `${Math.round(consistency.score * 100)}%`}`}
          description={describe(consistency)}
          onOpen={onOpenTip}
        />
      )}
      <div className="flex flex-col items-start gap-2.5 min-w-0">
        {top && <div className="flex flex-wrap items-center gap-3">{top}</div>}
        <div className="flex flex-wrap items-center gap-3">{bottom}</div>
      </div>
    </div>
  );
}

// A row's health on the Habits and category pages, at its start, where the Agenda's rows have a ring
// to log them (see LogRing), and as big: its plant, all gray for one with no cadence (`consistency`
// null, or not worked out) or one freshly planted. The percentage is in its title.
export function HealthMark({ consistency }: { consistency: Consistency | null | undefined }) {
  if (!consistency) {
    return (
      <span className="w-11 h-11 shrink-0 flex items-center justify-center" title={NO_CADENCE} role="img" aria-label={NO_CADENCE}>
        <PlantIcon layers={0} className="h-7" />
      </span>
    );
  }
  const level = LEVELS[consistency.level];
  const description = describe(consistency);
  return (
    <span className={`w-11 h-11 shrink-0 flex items-center justify-center ${level.color}`} title={description} role="img" aria-label={description}>
      <PlantIcon layers={level.layers} className="h-7" />
    </span>
  );
}
