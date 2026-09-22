const today = new Date('2026-09-21T00:00:00'); // Monday
const weeks = 52;

let startDate = new Date(today);
if (weeks >= 52) {
  startDate.setMonth(startDate.getMonth() - 11);
  startDate.setDate(1);
} else {
  startDate.setDate(today.getDate() - weeks * 7 + 1);
  startDate.setDate(startDate.getDate() - startDate.getDay());
}

let endDate = new Date(today);
endDate.setDate(today.getDate() + (6 - today.getDay()));

const allDays = [];
for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  allDays.push(new Date(d));
}

const columns = [];
let currentColumn = [];
let currentMonths = new Set();

for (let i = 0; i < allDays.length; i++) {
  const d = allDays[i];
  const monthStr = `${d.getFullYear()}-${d.getMonth()}`;
  
  if (!currentMonths.has(monthStr)) {
    if (currentMonths.size === 4) {
      columns.push(currentColumn);
      currentColumn = [];
      currentMonths = new Set();
    }
    currentMonths.add(monthStr);
  }
  currentColumn.push(d);
}
if (currentColumn.length > 0) columns.push(currentColumn);

for(let i=0; i<columns.length; i++) {
  const col = columns[i];
  console.log(`Col ${i+1}: starts ${col[0].toISOString().split('T')[0]}, ends ${col[col.length-1].toISOString().split('T')[0]}`);
}

