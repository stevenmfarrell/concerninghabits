import * as chrono from 'chrono-node';
import { civilDateFor, parseBedtimeOffsetMinutes, wallTimeToInstant, zoneOffsetMinutes, type DayOwner } from './timezone';

// The time of day an entry is given when what was said names a day but not a time
const DEFAULT_HOUR = 12;

// A date whose local time (the server's, which chrono reads dates in) shows what a clock in
// `timeZone` shows at `instant`. Passing chrono a time zone instead isn't enough: some of its
// parsers (e.g. "the day before yesterday") still count days in the server's local time.
function wallClock(instant: Date, timeZone: string) {
  const wall = new Date(instant.getTime() + zoneOffsetMinutes(instant, timeZone) * 60_000);
  return new Date(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds());
}

// The civil date and time of day chrono found
function parts(start: chrono.ParsedComponents) {
  return { day: new Date(Date.UTC(start.get('year')!, start.get('month')! - 1, start.get('day')!)), hour: start.get('hour') ?? 0, minute: start.get('minute') ?? 0 };
}

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
  const results = chrono.parse(text, wallClock(reference, user.timeZone), { forwardDate: false });

  for (const { text: said, start } of results) {
    // A date in numbers alone ("10/10", "1984", "5/3/1") is more likely a value, a title or a name
    if (!/[a-z]/i.test(said)) continue;
    const timed = start.isCertain('hour');

    // "2 hours ago" counts back from the moment, not from the user's day
    if (timed && /\bago\b/i.test(said)) {
      const [exact] = chrono.parse(said, wallClock(now, user.timeZone));
      if (!exact) continue;
      const { day, hour, minute } = parts(exact.start);
      const instant = wallTimeToInstant(day, hour, minute, user.timeZone);
      if (instant < now) return instant;
      continue;
    }

    const { day, hour, minute } = parts(start);
    if (day < today) return wallTimeToInstant(day, timed ? hour : DEFAULT_HOUR, timed ? minute : 0, user.timeZone);
    if (day.getTime() === today.getTime() && timed && /\btoday\b|\bthis (morning|afternoon|evening)\b/i.test(said)) {
      const instant = wallTimeToInstant(day, hour, minute, user.timeZone);
      if (instant < now) return instant;
    }
  }
  return null;
}
