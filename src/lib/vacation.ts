import { addDays, civilDayKey, parseCivilDayKey } from './timezone';

// Vacations: stretches of days the user is away, on each of which every habit and category of theirs
// counts as skipped, so nothing's due, nothing's held against its health, and no reminders are sent
// (see the user's `vacations` in CadenceUser).
// Days are civil day keys ("2026-10-09"), both ends inclusive; `to` is null for one with no end set,
// which runs until it's ended.
export interface VacationRange {
  from: string;
  to: string | null;
}


// The vacation the user is on today, or failing that the next one coming up; null for neither
export function currentVacation<V extends VacationRange>(vacations: V[], today: string): (V & { active: boolean }) | null {
  const ongoing = vacations.find(v => v.from <= today && (v.to === null || v.to >= today));
  if (ongoing) return { ...ongoing, active: true };
  const upcoming = vacations.filter(v => v.from > today).sort((a, b) => a.from.localeCompare(b.from))[0];
  return upcoming ? { ...upcoming, active: false } : null;
}

// What ending a vacation today does to it: one that's started keeps the days already taken (through
// yesterday), and today is a normal day again; one that hasn't, or only started today, is removed
export function endVacation(vacation: VacationRange, today: string): { remove: true } | { to: string } {
  if (vacation.from >= today) return { remove: true };
  return { to: civilDayKey(addDays(parseCivilDayKey(today)!, -1)) };
}

// Why a vacation can't be set from `from` to `to` (as of `today`), or null when it can
export function vacationProblem(from: string, to: string | null, today: string): string | null {
  if (!parseCivilDayKey(from) || (to !== null && !parseCivilDayKey(to))) return 'Pick valid dates';
  if (from < today) return "A vacation can't start in the past";
  if (to !== null && to < from) return "A vacation can't end before it starts";
  return null;
}

// A civil day key for people, e.g. "Oct 20"
export function formatVacationDay(key: string) {
  return parseCivilDayKey(key)!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// A vacation for people: "On vacation until Oct 20" (or "until you end it") while it's on, and
// "Vacation from Oct 15 to Oct 20" (or just "from Oct 15") before it starts
export function describeVacation({ from, to, active }: VacationRange & { active: boolean }) {
  if (active) return to === null ? 'On vacation until you end it' : `On vacation until ${formatVacationDay(to)}`;
  return to === null ? `Vacation from ${formatVacationDay(from)}` : `Vacation from ${formatVacationDay(from)} to ${formatVacationDay(to)}`;
}
