const today = new Date('2026-09-22T12:00:00Z');
const labels = [];
let currentMonth = -1;

// Simulate dates
const dates = [
  new Date('2025-10-01T12:00:00Z'),
  new Date('2025-11-01T12:00:00Z'),
  new Date('2025-12-01T12:00:00Z'),
  new Date('2026-01-01T12:00:00Z'),
  new Date('2026-02-01T12:00:00Z'),
];

for (const d of dates) {
  const month = d.toLocaleString('default', { month: 'short' }).toUpperCase();
  let text = month;
  if (d.getMonth() === 0 || d.getMonth() === 11) {
    text = `${month} ${d.getFullYear().toString().slice(-2)}`;
  }
  console.log(`${d.toISOString()} -> ${text}`);
}
