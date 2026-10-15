-- A self-hosted server is one household, so everyone already on it is connected to everyone else,
-- as adding a family member now does (see src/lib/connections.ts). One row per pair, smaller id
-- first. A new database (e.g. the hosted version's) has no users yet, so this adds nothing there.
INSERT INTO "Connection" ("userAId", "userBId")
SELECT a."id", b."id" FROM "User" a JOIN "User" b ON a."id" < b."id"
WHERE NOT EXISTS (SELECT 1 FROM "Connection" c WHERE c."userAId" = a."id" AND c."userBId" = b."id");
