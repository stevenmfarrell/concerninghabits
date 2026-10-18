#!/bin/sh
# The hosted version's startup on Fly.io (the Dockerfile's fly target), in place of the self-host
# image's start.sh: the same migrations and server, with Litestream backing the database up to R2.
set -e

# The server, as Litestream runs it (see the end of this script). Next's server exits with 143 when
# it's stopped, which Litestream counts as a failure and so skips its last sync, losing the latest
# changes. Here a stop passes the signal on to node and, once it has exited, counts as a clean exit.
if [ "$1" = serve ]; then
  set +e
  stopping=
  trap 'stopping=1; kill -TERM "$pid" 2>/dev/null' INT TERM
  node server.js &
  pid=$!
  # A trapped signal interrupts wait, so wait again until node has really exited
  while kill -0 "$pid" 2>/dev/null; do
    wait "$pid"
    status=$?
  done
  [ -n "$stopping" ] && exit 0
  exit "$status"
fi

# Fly mounts its volume owned by root, so this starts as root, hands /app/data to the app's user,
# and re-runs itself as that user
if [ "$(id -u)" = 0 ]; then
  chown nextjs:nodejs /app/data
  exec su-exec nextjs "$0" "$@"
fi

# On an empty volume (a new or replaced machine), bring the database back from R2 first. Does
# nothing when the database is already here, or when there's no backup yet.
litestream restore -config /etc/litestream.yml -if-db-not-exists -if-replica-exists \
  /app/data/concerning_habits.db

prisma migrate deploy

# Litestream only replicates a database that's already in WAL mode when it starts. The app switches
# to WAL itself (see enableWriteAheadLog), but only after Litestream is running, which on a new
# volume, where migrations have just created the database, is too late: nothing would be backed up
# until the next restart.
echo 'PRAGMA journal_mode = WAL;' | prisma db execute --stdin --schema prisma/schema.prisma

# Litestream supervises the server: it starts it once replication is running, passes it Fly's stop
# signal, and syncs a last time once it has exited
exec litestream replicate -config /etc/litestream.yml -exec "$0 serve"
