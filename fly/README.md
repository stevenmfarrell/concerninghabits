# The hosted version on Fly.io

Production (`concerninghabits`, at app.concerninghabits.com, configured by `fly.toml`) and staging (`concerninghabits-staging`, by `fly.staging.toml`) run the Dockerfile's `fly` target. It is the self-host image plus Litestream, started by `start.sh` here instead of the image's own start script.

## The two apps

| | Production | Staging |
|---|---|---|
| Fly app | `concerninghabits` | `concerninghabits-staging` |
| Address | https://app.concerninghabits.com (also `concerninghabits.fly.dev`, where Google sign-in doesn't work) | https://concerninghabits-staging.fly.dev |
| Machine | One, always running: the reminder scheduler is inside the app, so a stopped machine sends none | One, stopped when idle and started by the next request |
| Size | shared CPU, 1GB of memory | shared CPU, 512MB of memory |
| Volume | `data` at `/app/data`, 3GB, growing to 10GB | `data` at `/app/data`, 1GB, growing to 3GB |
| Backups | R2 bucket `concerninghabits-backups` | R2 bucket `concerninghabits-staging-backups` |
| Deployed | On a `v*.*.*` release tag | On every push to `main` |

Both are in Fly's `iad` region, under the personal organization, with a shared IPv4 address and a dedicated IPv6 one (both free). Keep each to one machine: the database is a SQLite file on that machine's volume, and two machines would also both write to the backup.

## Outside the repo

Set up by hand, so neither the code nor its history shows it:

- **DNS:** `app.concerninghabits.com` is an A and an AAAA record in Cloudflare, pointing at production's addresses (`fly ips list -a concerninghabits`), with Cloudflare's proxy off so Fly can issue and renew its certificate (`fly certs check app.concerninghabits.com -a concerninghabits`). The marketing site at `concerninghabits.com` is separate (see `site/`).
- **Google sign-in:** one Google Cloud OAuth client is shared by both apps. Its authorized redirect URIs include each address's `/api/auth/google/callback`, so a new address needs adding there. It's in Testing mode, so only its test users can sign in at all. Publishing it (#88) opens sign-in to any Google account, which `ALLOWED_EMAILS` can still limit.
- **Cloudflare R2:** the two buckets, and an R2 API token with read and write access to them, used by both apps. The account id is in each Fly config's `LITESTREAM_ENDPOINT`.
- **GitHub:** the `staging` and `production` environments and their `FLY_API_TOKEN` and `SENTRY_AUTH_TOKEN` secrets (see Deploys below).
- **Sentry:** one project for both apps, told apart by environment, and its alerts (see Monitoring below).
- **UptimeRobot:** the uptime monitor on production (see Monitoring below).
- **Secrets on Fly**, below.

## Secrets

Fly secrets are set with `fly secrets set -a <app> NAME=value` (which restarts the app; add `--stage` to wait for the next deploy) and can't be read back, only listed by name (`fly secrets list -a <app>`). Both apps have the same set, with staging's own `APP_URL`:

- `DEPLOYMENT_MODE=cloud`, `APP_URL` (`https://app.concerninghabits.com`, or the staging address), `COOKIE_SECURE=true`
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, from the OAuth client above
- `GOOGLE_GENERATIVE_AI_API_KEY` and `TYPESAFE_API_KEY`, the AI keys, shared by both apps, so staging's AI use goes on the same bill. `AI_REASONING_EFFORT` isn't set, so the app's default applies.
- `ALLOWED_EMAILS`, the Google accounts that can sign in (see the README)
- `LITESTREAM_ACCESS_KEY_ID` and `LITESTREAM_SECRET_ACCESS_KEY`, the R2 token
- `SENTRY_DSN`, the Sentry project's DSN, shared by both apps

The settings that aren't secret (the R2 bucket and endpoint, the Sentry environment and production's reminder monitor) are under `[env]` in each app's Fly config.

## Deploys

`.github/workflows/deploy.yml` deploys staging on every push to `main`, and production when a release tag like `v1.2.3` is pushed (not a pre-release like `v1.3.0-rc.1`). Fly builds the `fly` target from that commit. Each app has its own deploy token, the `FLY_API_TOKEN` secret of the GitHub environment of the same name, which only accepts `main` (staging) or `v*.*.*` tags (production). To replace one, create a new token and store it, then revoke the old one (`fly tokens list -a <app>`):

```sh
fly tokens create deploy -a concerninghabits --name github-actions-production | gh secret set FLY_API_TOKEN --env production
```

Each environment also has a `SENTRY_AUTH_TOKEN` secret, a Sentry organization token, which the deploy passes to Fly's builder as a build secret so the build can upload its source maps (see `next.config.ts`). The organization and project it uploads to are the `SENTRY_ORG` and `SENTRY_PROJECT` build args in each Fly config. Without the token, the deploy still works and reports show minified code. To replace it, create a new organization token in Sentry and store it in both environments: `gh secret set SENTRY_AUTH_TOKEN --env staging` and `--env production`, each reading the token from standard input.

To deploy by hand instead, `fly deploy` (production) or `fly deploy -c fly.staging.toml` (staging) from a checkout of the commit you want.

## Monitoring

- **Errors:** both apps send their errors, the server's and the browser's, to Sentry (see `src/lib/errorReporting.ts`), as the `production` or `staging` environment (`SENTRY_ENVIRONMENT`). That covers anything that breaks a request, and failures the app catches but that mean something is wrong: the reminder scheduler, sending a notification, Google sign-in, AI requests, and the health check. No personal data is sent (see `src/lib/errorScrubbing.ts`). Sentry emails new issues by default; only production's need attention.
- **Reminders:** production checks in with the Sentry cron monitor `reminder-scheduler` on every one-minute reminder check (`SENTRY_REMINDER_MONITOR`), which creates the monitor on its first check-in. Sentry raises an alert after three missed or failed check-ins in a row, so a deploy's restart doesn't set it off. Staging doesn't check in: its machine stops when idle.
- **Uptime:** UptimeRobot requests `https://app.concerninghabits.com/api/health` every 5 minutes and alerts by email when it doesn't answer 200 (the endpoint gives 503 when the database can't be read). Fly's own health check on the same route restarts the machine but alerts no one. Staging isn't monitored.

## Backups

Each app's SQLite database is backed up continuously to its own private Cloudflare R2 bucket, `concerninghabits-backups` and `concerninghabits-staging-backups`, by [Litestream](https://litestream.io) 0.5 (`litestream.yml`). A change reaches R2 within about a second, and Litestream syncs one last time when the machine stops. The bucket and endpoint are in each app's Fly config, and the R2 API token is the `LITESTREAM_ACCESS_KEY_ID` and `LITESTREAM_SECRET_ACCESS_KEY` secrets.

Fly also takes a daily snapshot of each volume and keeps it for 5 days (`fly volumes snapshots list <volume id>`), as a second copy that doesn't depend on Litestream or R2.

To see what's in an app's bucket, newest last:

```sh
fly ssh console -a concerninghabits -u nextjs -C "litestream ltx -config /etc/litestream.yml /app/data/concerning_habits.db"
```

## Restoring

A machine that starts with an empty volume restores the database from R2 before it does anything else (see `start.sh`), so restoring is a matter of starting the app on a new volume. To replace a lost or damaged volume:

1. Stop the machine, so that it stops writing to the backup: `fly machine stop <machine id> -a <app>`.
2. Create an empty volume in the same region: `fly volumes create data -s 3 -r iad -a <app>` (1GB for staging).
3. Start a copy of the machine on it: `fly machine clone <machine id> -a <app> --attach-volume <new volume id>:/app/data`. Its log shows Litestream fetching from the replica, and `/api/health` answers once the database is back.
4. Check the data is there, then destroy the old machine and its volume: `fly machine destroy <old machine id> -a <app>` and `fly volumes destroy <old volume id> -a <app>`. Until then, keep the old machine from being started for traffic with `fly machine cordon <old machine id> -a <app>`: **never let two machines run against the same bucket**, as both would write to the backup.

This was tested on staging on 2026-10-18: a row written a second before the machine was stopped came back, along with the account already there.

To bring the database back as it was at an earlier time instead (for example, before a bad migration; not yet tested), restore to a file on a stopped copy of the machine with `litestream restore -config /etc/litestream.yml -timestamp <RFC 3339 time> -o /app/data/restored.db /app/data/concerning_habits.db`, then swap it in for `concerning_habits.db` (and remove the `-wal` and `-shm` files beside it) before starting the app.
