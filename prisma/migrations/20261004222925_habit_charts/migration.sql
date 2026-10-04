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
    "cadence" TEXT NOT NULL DEFAULT '{"type":"daily","timesPerDay":1}',
    "calculatedFields" TEXT NOT NULL DEFAULT '[]',
    "charts" TEXT NOT NULL DEFAULT '[]',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Habit" ("cadence", "calculatedFields", "createdAt", "description", "frequency", "id", "name", "publishToMqtt", "schema", "userId") SELECT "cadence", "calculatedFields", "createdAt", "description", "frequency", "id", "name", "publishToMqtt", "schema", "userId" FROM "Habit";
DROP TABLE "Habit";
ALTER TABLE "new_Habit" RENAME TO "Habit";
CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
