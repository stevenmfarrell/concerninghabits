const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const habits = await prisma.habit.findMany();
  console.log("Habits count:", habits.length);
  if (habits.length > 0) {
    console.log("Last habit:", habits[habits.length - 1]);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
