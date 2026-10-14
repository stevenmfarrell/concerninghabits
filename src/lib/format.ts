import type { FieldSchema } from './formFields';

export function formatDuration(totalMinutes: number): string {
  if (typeof totalMinutes !== 'number') return String(totalMinutes);
  
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  const s = Math.round((totalMinutes - Math.floor(totalMinutes)) * 60);
  
  const mStr = m.toString().padStart(2, '0');
  const sStr = s.toString().padStart(2, '0');
  
  if (h > 0) {
    return `${h}:${mStr}:${sStr}`;
  } else {
    return `${m}:${sStr}`;
  }
}

export function formatLogValue(val: unknown, propSchema?: Pick<FieldSchema, 'x-widget' | 'x-unit'>): string {
  if (val === undefined || val === null) return '';
  if (propSchema?.['x-widget'] === 'duration' && typeof val === 'number') {
    return formatDuration(val);
  }
  if (typeof val === 'boolean') {
    return val ? 'Yes' : 'No';
  }
  
  const strVal = String(val);
  if (propSchema?.['x-unit']) {
    return `${strVal} ${propSchema['x-unit']}`;
  }
  
  return strVal;
}

const DAYS_PER_MONTH = 365.25 / 12;

const SHORT_UNITS = { day: 'd', week: 'w', month: 'mo' } as const;

// A span of days the way people say it, fuzzier the longer it is: days up to 10, then weeks up to
// 6, then months, rounded, e.g. 4 -> "4 days", 12 -> "2 weeks", 60 -> "2 months". `short` is the
// compact form, e.g. "4d", "2w", "2mo".
export function fuzzyDays(days: number) {
  const [count, unit] =
    days < 11 ? [days, 'day' as const]
    : days < 7 * 7 ? [Math.round(days / 7), 'week' as const]
    : [Math.round(days / DAYS_PER_MONTH), 'month' as const];
  return { count, unit: count === 1 ? unit : `${unit}s`, short: `${count}${SHORT_UNITS[unit]}` };
}

// A time as a datetime-local input's value ("2026-10-03T13:06"), in the browser's time zone, which
// is also how the input's value is read back
export function toDateTimeInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
