@AGENTS.md

## Database migrations

Never use `prisma db push` (local or in Docker) — it can silently drop columns on a schema change. Always go through committed migrations:

- **Local dev setup / after pulling schema changes:** `npx prisma migrate deploy`
- **After editing `prisma/schema.prisma`:** `npx prisma migrate dev --name <description>` to generate and apply a new migration, then commit the resulting `prisma/migrations/` folder.
- **Docker:** the container already runs `prisma migrate deploy` on startup (see `Dockerfile`'s `start.sh`) — don't change this back to `db push`.
- **Baselining an existing (pre-migration) database:** if a database has the current tables but no `_prisma_migrations` history (e.g. a self-hosted instance upgrading from an older image), `migrate deploy` will refuse to run. Fix with `npx prisma migrate resolve --applied 20260928000839_init` once, then future deploys proceed normally. See `README.md`'s Self-Hosting section for the Docker Compose version of this command.
