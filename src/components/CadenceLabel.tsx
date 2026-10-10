import { describeCadence, type Cadence } from '@/lib/cadence';

// A row's cadence under its name (e.g. "EVERY 3 DAYS"), in small caps like a section heading, so
// it reads as a label rather than a line of text, as the Agenda page's rows show it. Days of the
// week are in the order the user's weeks run (`weekStartsOn`).
export default function CadenceLabel({ cadence, weekStartsOn }: { cadence: Cadence; weekStartsOn: string }) {
  return <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-ink-muted truncate">{describeCadence(cadence, { weekStartsOn })}</p>;
}
