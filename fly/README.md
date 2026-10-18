# The hosted version on Fly.io

Production (`concerninghabits`, at app.concerninghabits.com, configured by `fly.toml`) and staging (`concerninghabits-staging`, by `fly.staging.toml`) run the Dockerfile's `fly` target. It is the self-host image plus Litestream, started by `start.sh` here instead of the image's own start script.

## Deploys

`.github/workflows/deploy.yml` deploys staging on every push to `main`, and production when a release tag like `v1.2.3` is pushed (not a pre-release like `v1.3.0-rc.1`). Fly builds the `fly` target from that commit. Each app has its own deploy token, the `FLY_API_TOKEN` secret of the GitHub environment of the same name, which only accepts `main` (staging) or `v*.*.*` tags (production). To replace one, create a new token and store it, then revoke the old one (`fly tokens list -a <app>`):

```sh
fly tokens create deploy -a concerninghabits --name github-actions-production | gh secret set FLY_API_TOKEN --env production
```

To deploy by hand instead, `fly deploy` (production) or `fly deploy -c fly.staging.toml` (staging) from a checkout of the commit you want.

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
