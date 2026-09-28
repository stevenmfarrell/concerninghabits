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

export function formatLogValue(val: unknown, propSchema?: { 'x-widget'?: string; 'x-unit'?: string }): string {
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
