const today = new Date();
today.setHours(0,0,0,0);
const currentDayOfWeek = today.getDay(); // 0 for Sunday
const mostRecentSunday = new Date(today);
mostRecentSunday.setDate(today.getDate() - currentDayOfWeek);

const weeks = 5;
const oldestSunday = new Date(mostRecentSunday);
oldestSunday.setDate(mostRecentSunday.getDate() - (weeks - 1) * 7);

for (let w = 0; w < weeks; w++) {
  let row = [];
  for (let d = 0; d < 7; d++) {
    const day = new Date(oldestSunday);
    day.setDate(oldestSunday.getDate() + w * 7 + d);
    if (day > today) {
       row.push('  '); // future
    } else {
       row.push(day.getDate().toString().padStart(2, '0'));
    }
  }
  console.log(row.join(' '));
}
