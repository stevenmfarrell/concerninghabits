-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "bedtime" TEXT NOT NULL DEFAULT '01:00',
    "weekStartsOn" TEXT NOT NULL DEFAULT 'sunday',
    "useEmojiTitle" BOOLEAN NOT NULL DEFAULT true,
    "emojiModifier" TEXT,
    "passwordNeedsUpdate" BOOLEAN NOT NULL DEFAULT false,
    "unitSystem" TEXT NOT NULL DEFAULT 'imperial',
    "timeZone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("bedtime", "createdAt", "email", "emojiModifier", "id", "isAdmin", "name", "passwordHash", "passwordNeedsUpdate", "timeZone", "unitSystem", "useEmojiTitle", "weekStartsOn") SELECT "bedtime", "createdAt", "email", "emojiModifier", "id", "isAdmin", "name", "passwordHash", "passwordNeedsUpdate", "timeZone", "unitSystem", "useEmojiTitle", "weekStartsOn" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Identity_userId_idx" ON "Identity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_provider_subject_key" ON "Identity"("provider", "subject");

