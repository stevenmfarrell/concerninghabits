const dates = [new Date('2026-09-16T12:00:00Z')]; // Wednesday
const day = new Date('2026-09-14T12:00:00Z'); // Monday of same week

const isSameWeek = (d1, d2) => {
  const s1 = new Date(d1);
  s1.setHours(0,0,0,0);
  s1.setDate(s1.getDate() - s1.getDay());
  
  const s2 = new Date(d2);
  s2.setHours(0,0,0,0);
  s2.setDate(s2.getDate() - s2.getDay());
  
  return s1.getTime() === s2.getTime();
}

console.log("Same week:", isSameWeek(day, dates[0])); // should be true

const isSameMonth = (d1, d2) => {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}
console.log("Same month:", isSameMonth(day, dates[0])); // should be true

