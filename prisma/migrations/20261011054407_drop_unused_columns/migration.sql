-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Habit" (
    "publishToMqtt" BOOLEAN NOT NULL DEFAULT false,
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schema" TEXT NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT '{"type":"daily","timesPerDay":1}',
    "calculatedFields" TEXT NOT NULL DEFAULT '[]',
    "charts" TEXT NOT NULL DEFAULT '[]',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Habit" ("cadence", "calculatedFields", "charts", "createdAt", "description", "id", "name", "publishToMqtt", "schema", "userId") SELECT "cadence", "calculatedFields", "charts", "createdAt", "description", "id", "name", "publishToMqtt", "schema", "userId" FROM "Habit";
DROP TABLE "Habit";
ALTER TABLE "new_Habit" RENAME TO "Habit";
CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");
CREATE TABLE "new_HabitMember" (
    "habitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "aiContext" TEXT,
    "remind" BOOLEAN NOT NULL DEFAULT false,
    "remindAt" TEXT,
    "remindMutedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("habitId", "userId"),
    CONSTRAINT "HabitMember_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HabitMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HabitMember_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HabitMember" ("aiContext", "categoryId", "createdAt", "habitId", "order", "remind", "remindAt", "remindMutedAt", "userId") SELECT "aiContext", "categoryId", "createdAt", "habitId", "order", "remind", "remindAt", "remindMutedAt", "userId" FROM "HabitMember";
DROP TABLE "HabitMember";
ALTER TABLE "new_HabitMember" RENAME TO "HabitMember";
CREATE INDEX "HabitMember_userId_categoryId_idx" ON "HabitMember"("userId", "categoryId");
CREATE INDEX "HabitMember_categoryId_idx" ON "HabitMember"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

