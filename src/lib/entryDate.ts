import * as chrono from 'chrono-node';
import { civilDateFor, parseBedtimeOffsetMinutes, wallTimeToInstant, zoneOffsetMinutes, type DayOwner } from './timezone';

// The time of day an entry is given when what was said names a day but not a time
const DEFAULT_HOUR = 12;

// When something said or typed says it was done, for logging it then rather than now: "yesterday",
// "3 days ago", "last Tuesday", "on October 10th", "yesterday at 6pm", "2 hours ago". A time later
// on the current day only counts with "today" or "this morning" said too ("today at 7am"), since
// durations like "in 25 minutes" read as times, and a bare "at 5" could be morning or evening. Days
// are the user's, ending at their bedtime, so "yesterday" just after midnight is the day before the
// one still going on. Null when it says nothing usable, to log it at `now`.
export function whenDone(text: string, user: DayOwner, now = new Date()): Date | null {
  // Counted from the user's day, which hasn't ended yet before their bedtime
  const reference = new Date(now.getTime() - parseBedtimeOffsetMinutes(user.bedtime) * 60_000);
  const today = civilDateFor(now, user);
  const results = chrono.parse(text, { instant: reference, timezone: zoneOffsetMinutes(reference, user.timeZone) }, { forwardDate: false });

  for (const { text: said, start } of results) {
    // A date in numbers alone ("10/10", "1984", "5/3/1") is more likely a value, a title or a name
    if (!/[a-z]/i.test(said)) continue;
    const timed = start.isCertain('hour');

    // "2 hours ago" counts back from the moment, not from the user's day
    if (timed && /\bago\b/i.test(said)) {
      const [exact] = chrono.parse(said, { instant: now, timezone: zoneOffsetMinutes(now, user.timeZone) });
      const instant = exact?.start.date();
      if (instant && instant < now) return instant;
      continue;
    }

    const day = new Date(Date.UTC(start.get('year')!, start.get('month')! - 1, start.get('day')!));
    if (day < today) return wallTimeToInstant(day, timed ? start.get('hour')! : DEFAULT_HOUR, timed ? start.get('minute') ?? 0 : 0, user.timeZone);
    if (day.getTime() === today.getTime() && timed && /\btoday\b|\bthis (morning|afternoon|evening)\b/i.test(said)) {
      const instant = wallTimeToInstant(day, start.get('hour')!, start.get('minute') ?? 0, user.timeZone);
      if (instant < now) return instant;
    }
  }
  return null;
}
