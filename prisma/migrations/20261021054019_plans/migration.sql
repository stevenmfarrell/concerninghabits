-- AlterTable
ALTER TABLE "User" ADD COLUMN "paidUntil" DATETIME;
ALTER TABLE "User" ADD COLUMN "trialEndsAt" DATETIME;


-- Accounts made before plans existed start their 14-day trial now (see TRIAL_DAYS in
-- src/lib/plans.ts), stored as Prisma stores dates in SQLite: milliseconds since 1970
UPDATE "User" SET "trialEndsAt" = (CAST(strftime('%s', 'now') AS INTEGER) + 14 * 86400) * 1000;
