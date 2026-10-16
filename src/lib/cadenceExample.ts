import { addDays } from './timezone';
import { startOfWeek, type Cadence } from './cadence';

// A cadence worked through from today, for its settings (see CadenceSettings): when doing it today
// would make it due again, or how long it would count for. It shows the difference between a
// calendar week or month, which counts any day in it and starts over on schedule, and every N days,
// counted from the last time, better than describing it. `today` is a civil date (UTC midnight for
// the user's day); null for a cadence with nothing to work through.

const weekday = (day: Date) => day.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
const monthDay = (day: Date) => day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
const monthName = (day: Date) => day.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });

export function cadenceExample(cadence: Cadence, today: Date, weekStartsOn: string): string | null {
  switch (cadence.type) {
    case 'everyNDays': {
      const next = addDays(today, cadence.days);
      return `Do it today (${weekday(today)}), and it's due again ${cadence.days} days later, on ${weekday(next)}, ${monthDay(next)}.`;
    }
    case 'calendarWeek': {
      const weekStart = startOfWeek(today, weekStartsOn);
      const nextWeek = addDays(weekStart, 7);
      const starts = nextWeek.getTime() === addDays(today, 1).getTime() ? `tomorrow (${weekday(nextWeek)})` : weekday(nextWeek);
      return (cadence.times ?? 1) === 1
        ? `Do it today (${weekday(today)}), and it's done for this week. A new week starts ${starts}.`
        : `It's done once it's logged ${cadence.times} times in a week, on any days. Your weeks run ${weekday(weekStart)} to ${weekday(addDays(weekStart, 6))}, so a new one starts ${starts}.`;
    }
    case 'calendarMonth': {
      const nextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
      return (cadence.times ?? 1) === 1
        ? `Do it today (${monthDay(today)}), and it's done for ${monthName(today)}. A new month starts ${monthDay(nextMonth)}.`
        : `It's done once it's logged ${cadence.times} times in a month, on any days. A new month starts ${monthDay(nextMonth)}.`;
    }
    default:
      return null;
  }
}
