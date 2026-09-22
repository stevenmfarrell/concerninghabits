const today = new Date('2026-09-21T00:00:00'); // Mock today
const weeks = 52;
const oldestDay = new Date(today);
oldestDay.setDate(today.getDate() - weeks * 7);

// Collect all days
const days = [];
for (let d = new Date(oldestDay); d <= today; d.setDate(d.getDate() + 1)) {
  days.push(new Date(d));
}

// Group by month
const monthsMap = new Map(); // key: YYYY-MM
for (const d of days) {
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (!monthsMap.has(key)) monthsMap.set(key, { monthStr: key, days: [] });
  monthsMap.get(key).days.push(d);
}

const months = Array.from(monthsMap.values());
console.log(`Total months: ${months.length}`);

// Pad each month
for (const m of months) {
  const firstDay = m.days[0];
  const padStart = firstDay.getDay(); // 0 for Sun
  const padded = Array(padStart).fill(null).concat(m.days);
  const padEnd = (7 - (padded.length % 7)) % 7;
  m.paddedDays = padded.concat(Array(padEnd).fill(null));
  console.log(`${m.monthStr}: ${m.paddedDays.length / 7} weeks`);
}

// Group into columns of 4 months
const columns = [];
for (let i = 0; i < months.length; i += 4) {
  columns.push(months.slice(i, i + 4));
}
console.log(`Columns: ${columns.length}`);

