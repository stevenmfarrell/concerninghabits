@AGENTS.md

## Database migrations

Never use `prisma db push` (local or in Docker) — it can silently drop columns on a schema change. Always go through committed migrations:

- **Local dev setup / after pulling schema changes:** `npx prisma migrate deploy`
- **After editing `prisma/schema.prisma`:** `npx prisma migrate dev --name <description>` to generate and apply a new migration, then commit the resulting `prisma/migrations/` folder.
- **Docker:** the container already runs `prisma migrate deploy` on startup (see `Dockerfile`'s `start.sh`) — don't change this back to `db push`.

## The hosted version

The hosted version at app.concerninghabits.com runs on Fly.io, with a staging app beside it. Read [fly/README.md](./fly/README.md) before deploying it or changing anything about it: what runs where, what was set up outside the repo, its secrets, deploys and backups. Production deploys from release tags, not by hand. Never print a secret's value (pipe it into `fly secrets set` or `gh secret set` instead). When you change any of the setup, update fly/README.md in the same change.

## README drift

`README.md` is the self-hosting guide, and CI fails a pull request when it disagrees with the code (`node scripts/check-readme.mjs`): every environment variable the app reads must be mentioned in it, every API-key route documented as `METHOD /api/...`, and the compose example's port, volume and image must match the Dockerfile and repo. When you add, rename or remove a setting or an API route, update the README (and `.env.example`) in the same change, and run the script before pushing.
