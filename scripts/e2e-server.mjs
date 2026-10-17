#!/usr/bin/env node
// Serves the production build for the end-to-end tests (see playwright.config.ts), as the Docker
// image does: the standalone server, with the service worker caching for offline, on a database of
// its own, made fresh from the committed migrations each run. Build first (`npm run build`).
//
// It's the build, not `next dev`, because the service worker only keeps pages for offline in a
// production build. On 127.0.0.1 rather than localhost, so a developer's own signed-in session on
// localhost:3000 can't be sent along with the tests' requests.

import { execSync, spawn } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const E2E_PORT = 3007;
// Absolute: the standalone server runs from .next/standalone, where a relative path would point
// somewhere else
const database = path.join(root, 'prisma', 'e2e.db');
const databaseUrl = `file:${database}`;
const standalone = path.join(root, '.next', 'standalone');

if (!existsSync(path.join(standalone, 'server.js'))) {
  console.error('No production build to serve. Run `npm run build` first.');
  process.exit(1);
}

for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(database + suffix, { force: true });
execSync('npx prisma migrate deploy', { cwd: root, stdio: 'inherit', env: { ...process.env, DATABASE_URL: databaseUrl } });

// The standalone output leaves out the static files, which the Dockerfile copies in beside it
cpSync(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true });
cpSync(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true });

// No AI and no integrations: the tests don't need them, and must never reach a real service
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (/^(AI_|GOOGLE_|ANTHROPIC_|OPENAI_|TYPESAFE_|MQTT_|HABIT_MATCHER|VAPID_)/.test(name)) delete env[name];
}
const server = spawn(process.execPath, [path.join(standalone, 'server.js')], {
  stdio: 'inherit',
  env: { ...env, NODE_ENV: 'production', PORT: String(E2E_PORT), HOSTNAME: '127.0.0.1', DATABASE_URL: databaseUrl, DEPLOYMENT_MODE: 'selfhost' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', code => process.exit(code ?? 0));
