# Next 16 requires Node >= 20.9
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Only the package files first, so this layer (and the slow install) is reused until they change.
# npm's download cache is kept between builds on the same machine, for when they do.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Builds on deps rather than copying its node_modules into a fresh stage, which would store the
# biggest layer twice in the build cache
FROM deps AS builder
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Build the app. Next's build cache is kept between builds on the same machine, so a rebuild after a
# small change only redoes what changed.
RUN --mount=type=cache,target=/app/.next/cache npm run build

# Next's standalone output always includes sharp (about 28MB), for its image optimizer, which
# next.config.ts turns off
RUN rm -rf .next/standalone/node_modules/sharp .next/standalone/node_modules/@img

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# su-exec lets start.sh drop from root to the app's user
RUN apk add --no-cache openssl su-exec

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 -G nodejs nextjs

# The Prisma CLI applies migrations on startup (see start.sh). npm's download cache goes in a cache
# mount, which would otherwise add about 200MB to the image. Keep the version in step with prisma in
# package.json.
RUN --mount=type=cache,target=/root/.npm npm install -g prisma@6.19.3

# The app itself stays owned by root, so the unprivileged user that runs it can read it but not
# modify it. Output traces keep the image small:
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# The migrations, for start.sh. The standalone output above already holds the Prisma client and its
# query engine.
COPY --from=builder /app/prisma ./prisma

# The only places the app writes: the SQLite database (a named volume mounts over /app/data and
# inherits this ownership) and Next's runtime cache.
RUN mkdir -p /app/data /app/.next/cache && chown nextjs:nodejs /app/data /app/.next/cache

# Started as root (the fly stage below), start.sh hands /app/data to the app's user, then re-runs
# itself as that user. It applies committed migrations, then replaces
# the shell with node so it receives `docker stop`'s SIGTERM directly and shuts down cleanly.
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'if [ "$(id -u)" = 0 ]; then' >> /app/start.sh && \
    echo '  chown nextjs:nodejs /app/data' >> /app/start.sh && \
    echo '  exec su-exec nextjs "$0" "$@"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'prisma migrate deploy' >> /app/start.sh && \
    echo 'exec node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="file:/app/data/concerning_habits.db"

# Docker marks the container healthy once the app answers /api/health, which needs its database.
# Node's own fetch rather than curl, which the image doesn't have. The start period covers
# migrations on startup.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# We must use sqlite in a volume, so we map DATABASE_URL in docker-compose
CMD ["/app/start.sh"]

# For Fly.io (fly.toml's build-target): its volumes mount owned by root, so this starts as root and
# start.sh hands /app/data to nextjs before dropping to it
FROM runner AS fly
USER root

# The default target, last so a plain `docker build` gives the image above
FROM runner
