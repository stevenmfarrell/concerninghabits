import { DEFAULT_TARGET_COUNT } from './constants';
import { civilDayKey, parseBedtimeOffsetMinutes, toCivilDate } from './timezone';

// The first day of the week a civil date falls in, by the user's week start ("sunday" or "monday")
export function startOfWeek(day: Date, weekStartsOn: string) {
  const start = new Date(day);
  const weekday = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (weekStartsOn === 'monday' ? (weekday + 6) % 7 : weekday));
  return start;
}

// Which of a habit's periods a civil date falls in, by its cadence: the day itself (daily, and
// multiple times a day), its week, or its month
function periodKey(day: Date, frequency: string, weekStartsOn: string) {
  if (frequency === 'weekly') return `week:${civilDayKey(startOfWeek(day, weekStartsOn))}`;
  if (frequency === 'monthly') return `month:${day.getUTCFullYear()}-${day.getUTCMonth()}`;
  return `day:${civilDayKey(day)}`;
}

// How many entries complete one of the habit's periods: its target for a multiple-times-a-day
// habit, otherwise one
function entriesNeeded(habit: { frequency: string; schema: string }) {
  if (habit.frequency !== 'multiple') return 1;
  try {
    return JSON.parse(habit.schema).targetCount || DEFAULT_TARGET_COUNT;
  } catch {
    return DEFAULT_TARGET_COUNT;
  }
}

// Whether a habit's current period is done: logged this day, week or month for its cadence, or,
// multiple times a day, as often as its target today. Days follow the user's time zone and bedtime,
// the same as the activity calendars. `logDates` are the entries that count, e.g. only the viewer's own.
export function isHabitComplete(
  habit: { frequency: string; schema: string },
  logDates: Date[],
  user: { timeZone: string; bedtime: string; weekStartsOn: string },
  now = new Date(),
) {
  const offset = parseBedtimeOffsetMinutes(user.bedtime);
  const current = periodKey(toCivilDate(now, user.timeZone, offset), habit.frequency, user.weekStartsOn);
  const count = logDates.filter(date => periodKey(toCivilDate(date, user.timeZone, offset), habit.frequency, user.weekStartsOn) === current).length;
  return count >= entriesNeeded(habit);
}
