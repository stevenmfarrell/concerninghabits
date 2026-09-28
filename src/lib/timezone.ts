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
