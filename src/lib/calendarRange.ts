import { startOfWeek } from './cadence';

// How many weeks a list row's calendar shows (the Agenda, Habits and category pages)
export const ROW_CALENDAR_WEEKS = 4;

// The first day an activity calendar of `weeks` weeks shows (see ActivityCalendar), for `today` (a
// civil date). A year starts on the 1st, 11 months back, so it's exactly 12 months. A few months
// (more than 7 weeks) start on the 1st of the month `weeks` weeks back. A few weeks start at the
// beginning of the week (weeks - 1) weeks back; with `wholeMonths`, a calendar that draws month
// dividers, that goes back to the 1st of its month when the month began earlier, so its first row
// never shows the tail of a month whose start is cut off (a divider over only part of the row).
export function calendarStart(today: Date, weeks: number, weekStartsOn: string, wholeMonths: boolean) {
  const start = new Date(today);
  if (weeks >= 52) {
    start.setUTCMonth(start.getUTCMonth() - 11);
    start.setUTCDate(1);
  } else if (weeks > 7) {
    start.setUTCDate(today.getUTCDate() - weeks * 7 + 1);
    start.setUTCDate(1);
  } else {
    const weekStart = startOfWeek(today, weekStartsOn);
    weekStart.setUTCDate(weekStart.getUTCDate() - (weeks - 1) * 7);
    start.setTime(weekStart.getTime());
    if (wholeMonths) start.setUTCDate(1);
  }
  return start;
}

// The days an activity calendar of `weeks` weeks shows for `today` (a civil date), first to last:
// from calendarStart to the end of today's week
export function calendarSpan(today: Date, weeks: number, weekStartsOn: string, wholeMonths: boolean) {
  const to = startOfWeek(today, weekStartsOn);
  to.setUTCDate(to.getUTCDate() + 6);
  return { from: calendarStart(today, weeks, weekStartsOn, wholeMonths), to };
}
