const today = new Date('2026-09-21T00:00:00');
const weeks = 52;
const currentDayOfWeek = today.getDay();
const mostRecentSunday = new Date(today);
mostRecentSunday.setDate(today.getDate() - currentDayOfWeek);
const oldestSunday = new Date(mostRecentSunday);
oldestSunday.setDate(mostRecentSunday.getDate() - (weeks - 1) * 7);

const days = [];
for (let d = new Date(oldestSunday); d <= today; d.setDate(d.getDate() + 1)) {
  days.push(new Date(d));
}

const columns = [];
let currentColumn = [];
let currentMonths = new Set();

for (let i = 0; i < days.length; i++) {
  const d = days[i];
  const monthStr = `${d.getFullYear()}-${d.getMonth()}`;
  
  if (!currentMonths.has(monthStr)) {
    if (currentMonths.size === 4) {
      // Time to split!
      columns.push(currentColumn);
      currentColumn = [];
      currentMonths = new Set();
    }
    currentMonths.add(monthStr);
  }
  
  currentColumn.push(d);
}
if (currentColumn.length > 0) columns.push(currentColumn);

// Now pad each column
for (let i = 0; i < columns.length; i++) {
  const col = columns[i];
  const firstDay = col[0];
  const padStart = firstDay.getDay();
  const padded = Array(padStart).fill(null).concat(col);
  
  const padEnd = (7 - (padded.length % 7)) % 7;
  columns[i] = padded.concat(Array(padEnd).fill(null));
  
  console.log(`Col ${i + 1}: ${columns[i].length / 7} weeks. Starts ${firstDay.toISOString().split('T')[0]}, Ends ${col[col.length-1].toISOString().split('T')[0]}`);
}

