// Time zone helpers shared by server and client code.
//
// A "civil date" is a calendar day in the user's time zone, stored as a Date at UTC midnight.
// Calendar math on civil dates uses only the UTC getters/setters, so it gives identical results
// on the server and in the browser no matter which time zone either one runs in.

export const TIMEZONE_COOKIE = 'tz';

export function isValidTimeZone(timeZone: string | undefined | null): timeZone is string {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function getDayFormatter(timeZone: string) {
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' });
    dayFormatters.set(timeZone, formatter);
  }
  return formatter;
}

// Minutes after midnight that still count as the previous day ("01:30" -> 90)
export function parseBedtimeOffsetMinutes(bedtime: string | undefined | null) {
  if (!bedtime) return 0;
  const [h, m] = bedtime.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// The civil date an instant falls on in `timeZone`, after shifting back by the bedtime offset
export function toCivilDate(instant: Date | string | number, timeZone: string, offsetMinutes = 0) {
  const shifted = new Date(new Date(instant).getTime() - offsetMinutes * 60_000);
  const parts = getDayFormatter(timeZone).formatToParts(shifted);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

export function civilDayKey(civilDate: Date) {
  return civilDate.toISOString().slice(0, 10);
}

// A civil date from its `civilDayKey` form ("2024-03-10"), or null if it isn't a real date in that form
export function parseCivilDayKey(key: string | undefined | null) {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const date = new Date(`${key}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || civilDayKey(date) !== key ? null : date;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

// A civil date `days` days after `day` (before it, for a negative number)
export function addDays(day: Date, days: number) {
  const shifted = new Date(day);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
}

// How many days after civil date `from` civil date `to` is (negative if it's before)
export const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

// Whose days an instant is placed on: a user's time zone, with their bedtime ending each day
export interface DayOwner {
  timeZone: string;
  bedtime: string;
}

// The civil date an instant falls on for `user`
export const civilDateFor = (instant: Date | string | number, user: DayOwner) => toCivilDate(instant, user.timeZone, parseBedtimeOffsetMinutes(user.bedtime));

// Today for `user`, as a civil day key
export const todayKeyFor = (user: DayOwner, now = new Date()) => civilDayKey(civilDateFor(now, user));

const minuteFormatters = new Map<string, Intl.DateTimeFormat>();

// How far `timeZone`'s clocks are ahead of UTC at `instant`, in minutes (e.g. -360 in Denver in summer)
export function zoneOffsetMinutes(instant: Date, timeZone: string) {
  let formatter = minuteFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
    minuteFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value);
  const wall = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
  return Math.round((wall - Math.floor(instant.getTime() / 60_000) * 60_000) / 60_000);
}

// The instant a clock in `timeZone` shows `hour`:`minute` on civil date `day`
export function wallTimeToInstant(day: Date, hour: number, minute: number, timeZone: string) {
  const wall = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute);
  // The offset at the wall time read as UTC is right unless a clock change falls in between, so
  // check it again at the instant that gives
  const guess = wall - zoneOffsetMinutes(new Date(wall), timeZone) * 60_000;
  return new Date(wall - zoneOffsetMinutes(new Date(guess), timeZone) * 60_000);
}
