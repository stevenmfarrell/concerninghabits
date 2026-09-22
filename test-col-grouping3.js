const today = new Date('2026-09-21T00:00:00');
const weeks = 52;
const oldestSunday = new Date(today);
oldestSunday.setDate(today.getDate() - today.getDay() - (weeks - 1) * 7);

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
      columns.push(currentColumn);
      currentColumn = [];
      currentMonths = new Set();
    }
    currentMonths.add(monthStr);
  }
  currentColumn.push(d);
}
if (currentColumn.length > 0) columns.push(currentColumn);

const processedColumns = columns.map(col => {
  const firstDay = col[0];
  const padStart = firstDay.getDay();
  const padded = Array(padStart).fill(null).concat(col);
  const padEnd = (7 - (padded.length % 7)) % 7;
  const fullCol = padded.concat(Array(padEnd).fill(null));
  
  const grid = [];
  const colWeeks = fullCol.length / 7;
  
  for (let w = 0; w < colWeeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = fullCol[w * 7 + d];
      if (!day) {
        grid.push({ isNull: true, w, d });
        continue;
      }
      
      const prevDay = d > 0 ? fullCol[w * 7 + d - 1] : null;
      const isNewMonthLeft = prevDay ? day.getMonth() !== prevDay.getMonth() : false;
      
      const prevWeekDay = w > 0 ? fullCol[(w - 1) * 7 + d] : null;
      const isNewMonthTop = prevWeekDay && prevWeekDay.getMonth() !== day.getMonth() ? true : false;
      
      grid.push({ date: day, isNull: false, isNewMonthLeft, isNewMonthTop, w, d });
    }
  }
  return grid;
});

const c2 = processedColumns[1];
for(let i=0; i<c2.length; i++) {
   const c = c2[i];
   if (!c.isNull && c.date.getMonth() === 1 && c.date.getDate() <= 2) {
      console.log(`${c.w},${c.d}: ${c.date.toISOString().split('T')[0]} left=${c.isNewMonthLeft} top=${c.isNewMonthTop}`);
   }
}

