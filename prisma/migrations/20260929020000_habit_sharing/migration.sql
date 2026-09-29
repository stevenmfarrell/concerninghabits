-- CreateTable
CREATE TABLE "HabitMember" (
    "habitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("habitId", "userId"),
    CONSTRAINT "HabitMember_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HabitMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HabitMember_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Give every existing habit an owner membership, carrying over its category, order, and favorite
-- flag before those columns are dropped from "Habit" below.
INSERT INTO "HabitMember" ("habitId", "userId", "categoryId", "order", "isFavorite", "createdAt")
SELECT "id", "userId", "categoryId", COALESCE("order", 0), "isFavorite", "createdAt" FROM "Habit";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Habit" (
    "publishToMqtt" BOOLEAN NOT NULL DEFAULT false,
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schema" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Habit" ("createdAt", "description", "frequency", "id", "name", "publishToMqtt", "schema", "userId") SELECT "createdAt", "description", "frequency", "id", "name", "publishToMqtt", "schema", "userId" FROM "Habit";
DROP TABLE "Habit";
ALTER TABLE "new_Habit" RENAME TO "Habit";
CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "HabitMember_userId_categoryId_idx" ON "HabitMember"("userId", "categoryId");

-- CreateIndex
CREATE INDEX "HabitMember_categoryId_idx" ON "HabitMember"("categoryId");

