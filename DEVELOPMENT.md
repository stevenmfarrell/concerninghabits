# Development

Notes on working on Concerning Habits itself. To run it, see the [README](README.md). The project isn't taking outside contributions right now.

It's a Next.js app (App Router, server actions) with Prisma on SQLite and Tailwind. Before changing anything under `src/app/` or `src/components/`, read [UI_STANDARDS.md](UI_STANDARDS.md): it covers the shared components and conventions every page uses.

## Setting Up

You need Node.js 22 (the version the Docker image uses; 20.9 or later works) and npm.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in an AI model's settings (see the README's [Choosing an AI Model](README.md#choosing-an-ai-model)). Everything else in it is optional.
3. Create the development database by applying the migrations:
   ```bash
   npx prisma migrate deploy
   ```
4. Start the development server, and open [http://localhost:3000](http://localhost:3000):
   ```bash
   npm run dev
   ```

To look at or edit the database directly, `npx prisma studio` opens a browser UI at [http://localhost:5555](http://localhost:5555).

The development server doesn't cache anything for offline use: the service worker only does that in a production build (`npm run build`, then `node .next/standalone/server.js`).

### Trying It on Your Phone

Installing the app and push notifications need https. The easiest way to get it during development is a tunnel:

1. With `npm run dev` running, run `npx localtunnel --port 3000` in another terminal.
2. Open the `https://` link it prints on your phone.
3. Use the browser's **Install app** or **Add to Home Screen**.

Next only serves its development scripts to origins it knows, so to open the dev server from your phone by its address on your network instead, add that address to `allowedDevOrigins` in `next.config.ts`.

## Checks

Pull requests can only merge into `main` once CI passes. Run the same checks locally first:

```bash
npm test                           # the test suite (vitest), against a throwaway database
npm run lint
npx next typegen && npx tsc --noEmit
node scripts/check-readme.mjs      # the README still matches the code
```

**The README check** keeps the self-hosting guide honest. It fails when the app reads an environment variable the README doesn't mention (or the README or `.env.example` sets one the app no longer reads), when an API-key route isn't documented as `METHOD /api/...`, or when the compose example's port, volume or image don't match the Dockerfile and repo. When you add, rename or remove a setting or an API route, update the README and `.env.example` in the same pull request.

## Changing the Database

Self-hosted instances only ever apply committed migrations (the container runs `prisma migrate deploy` on startup), so every schema change needs one:

1. Edit `prisma/schema.prisma`.
2. Create and apply a migration: `npx prisma migrate dev --name <what-changed>`.
3. Commit the new folder in `prisma/migrations/` along with the schema.

CI fails a pull request whose migrations don't produce exactly the schema in `schema.prisma`.

## Branches and Pull Requests

`main` only changes through pull requests.

- Branch from `main`, named for the change (`fix/...`, `feat/...`, `docs/...`), and keep it short-lived.
- Open a pull request into `main`. Pull requests are squash-merged, so the title and description become the commit on `main`: write them for someone reading the history.
- CI runs the checks above on every pull request. Changes to the app or its Docker setup also build the image for both architectures, without publishing it.

## Building the Docker Image

```bash
docker build -t concerninghabits .
```

To run a local build with the README's compose file, replace its `image:` line with `build: .` (pointing at a clone of this repo).

## Releases

Versions follow [semantic versioning](https://semver.org). For a self-hosted app, "breaking" means anything that needs a self-hoster to do something when they upgrade:

| Bump | When | Examples |
| --- | --- | --- |
| Patch (`1.2.0` → `1.2.1`) | Bug fixes only | A fix to signing in |
| Minor (`1.2.0` → `1.3.0`) | New features that upgrade safely on their own | A new API route, a new optional setting, a migration that only adds |
| Major (`1.x` → `2.0.0`) | Something stops working, or needs action | A renamed or removed setting, a changed volume path, a removed API route |

To release, make sure `main` is green, then create a release with a new tag, either on GitHub (Releases → Draft a new release, with **Generate release notes**) or with:

```bash
gh release create v1.2.3 --generate-notes
```

The tag starts `.github/workflows/release.yml`, which builds the image for `linux/amd64` and `linux/arm64` and publishes it to `ghcr.io/stevenmfarrell/concerninghabits` as `1.2.3`, `1.2`, `1` and `latest`. A pre-release (`v1.3.0-rc.1`) only gets its own tag. For a major version, say in the release notes what self-hosters need to do.
