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
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Habit" ("createdAt", "description", "frequency", "id", "name", "publishToMqtt", "schema", "userId") SELECT "createdAt", "description", "frequency", "id", "name", "publishToMqtt", "schema", "userId" FROM "Habit";
DROP TABLE "Habit";
ALTER TABLE "new_Habit" RENAME TO "Habit";
CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");

-- Each habit's cadence from its old frequency. A multiple-times-a-day habit's target was kept in its
-- form schema (`targetCount`, 3 when unset); it moves into the cadence and out of the schema. CASE
-- rather than AND guards json_extract, since SQLite doesn't promise AND short-circuits and a
-- malformed schema must not fail the migration.
UPDATE "Habit" SET "cadence" = CASE "frequency"
    WHEN 'weekly' THEN '{"type":"calendarWeek"}'
    WHEN 'monthly' THEN '{"type":"calendarMonth"}'
    WHEN 'multiple' THEN json_object('type', 'daily', 'timesPerDay',
        CASE WHEN json_valid("schema") THEN
            CASE WHEN CAST(json_extract("schema", '$.targetCount') AS INTEGER) >= 1
                THEN MIN(CAST(json_extract("schema", '$.targetCount') AS INTEGER), 100)
                ELSE 3 END
        ELSE 3 END)
    ELSE '{"type":"daily","timesPerDay":1}'
END;
UPDATE "Habit" SET "schema" = json_remove("schema", '$.targetCount')
WHERE CASE WHEN json_valid("schema") THEN json_extract("schema", '$.targetCount') IS NOT NULL ELSE 0 END;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
