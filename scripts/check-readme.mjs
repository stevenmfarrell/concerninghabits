#!/usr/bin/env node
// Checks that README.md (the self-hosting instructions) still matches the code, so it can't quietly
// go out of date. Run by CI on every pull request, or locally with `node scripts/check-readme.mjs`.
// It fails, listing every mismatch, when:
//
// - the app reads an environment variable the README never mentions, or the README (or
//   .env.example) sets one the app no longer reads
// - an API route that takes an API key isn't documented with its method, or the README documents a
//   route or method that doesn't exist (public routes, like /api/meta, may be documented too)
// - the README names a migration that isn't in prisma/migrations
// - the compose example's port, data volume or image don't match the Dockerfile and the repo
//
// Node built-ins only, so it runs without installing anything.

import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');

// Read by the runtime or Next itself rather than configured by a self-hoster
const NOT_SETTINGS = new Set(['NODE_ENV', 'NEXT_RUNTIME']);
// Next's standalone server reads these; the Dockerfile sets them, and a README may mention them
const SERVER_SETTINGS = new Set(['PORT', 'HOSTNAME']);

function filesUnder(dir, test) {
  return readdirSync(path.join(root, dir)).flatMap(name => {
    const rel = path.join(dir, name);
    if (statSync(path.join(root, rel)).isDirectory()) return filesUnder(rel, test);
    return test(rel) ? [rel] : [];
  });
}

const sourceFiles = filesUnder('src', f => /\.(ts|tsx|js|mjs)$/.test(f));

// Every environment variable the app reads: `process.env.X`, `process.env['X']`, destructured from
// process.env, schema.prisma's env("X"), and settings looked up by name (like aiModel.ts's
// REQUIRED_SETTING), which appear as quoted UPPER_SNAKE_CASE strings
function envVarsInCode() {
  const found = new Set();
  const add = name => { if (!NOT_SETTINGS.has(name)) found.add(name); };
  for (const file of sourceFiles) {
    const code = read(file);
    for (const [, name] of code.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) add(name);
    for (const [, name] of code.matchAll(/process\.env\[\s*['"`]([A-Z][A-Z0-9_]*)['"`]\s*\]/g)) add(name);
    for (const [, names] of code.matchAll(/\{([^}]*)\}\s*=\s*process\.env\b/g)) {
      for (const [, name] of names.matchAll(/([A-Z][A-Z0-9_]*)\s*(?::|,|$)/g)) add(name);
    }
    for (const [, name] of code.matchAll(/['"`]([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)['"`]/g)) add(name);
  }
  for (const [, name] of read('prisma/schema.prisma').matchAll(/env\("([A-Z][A-Z0-9_]*)"\)/g)) add(name);
  return found;
}

// Settings a document sets: `NAME=value`, at the start of a line (as in a .env file or a compose
// file's environment list, commented out or not) or in inline code
function envVarsSetIn(text) {
  const found = new Set();
  for (const [, name] of text.matchAll(/^[ \t]*(?:#[ \t]*)?(?:-[ \t]*)?([A-Z][A-Z0-9_]*)=/gm)) found.add(name);
  for (const [, name] of text.matchAll(/`([A-Z][A-Z0-9_]*)=/g)) found.add(name);
  return found;
}

// Every API route, with the methods it exports, as `/api/habits/[id]/log`, and whether another app
// calls it with an API key (it authenticates with authenticateApiRequest)
function apiRoutes() {
  return filesUnder('src/app/api', f => /(^|\/)route\.ts$/.test(f))
    .map(file => ({ file, code: read(file) }))
    .map(({ file, code }) => ({
      route: '/' + path.dirname(path.relative('src/app', file)).split(path.sep).join('/'),
      methods: [...code.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map(m => m[1]),
      takesKey: code.includes('authenticateApiRequest'),
    }));
}

// Whether a route as the README writes it (`/api/habits/<habit id>/log`) is this route
// (`/api/habits/[id]/log`): placeholders in either match any one segment
function sameRoute(documented, route) {
  const a = documented.split('/');
  const b = route.split('/');
  return a.length === b.length && a.every((segment, i) => {
    const placeholder = /^<.+>$/.test(segment) || /^\[.+\]$/.test(b[i]);
    return placeholder ? /^<.+>$/.test(segment) && /^\[.+\]$/.test(b[i]) : segment === b[i];
  });
}

function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY.toLowerCase();
  try {
    const url = execSync('git remote get-url origin', { cwd: root, encoding: 'utf8' }).trim();
    return url.match(/github\.com[:/](.+?)(?:\.git)?$/)?.[1].toLowerCase() ?? null;
  } catch {
    return null;
  }
}

// A route as the README writes it: segments, any of which can be a placeholder like <habit id>
const DOCUMENTED_ROUTE = String.raw`/api(?:/(?:<[^>\n]+>|[^\s/\x60?)<]+))+`;

const readme = read('README.md');
const problems = [];

// Environment variables, both ways
const inCode = envVarsInCode();
const known = new Set([...inCode, ...SERVER_SETTINGS]);
for (const name of inCode) {
  if (!new RegExp(`\\b${name}\\b`).test(readme)) problems.push(`The app reads ${name}, but README.md never mentions it.`);
}
for (const [file, text] of [['README.md', readme], ['.env.example', read('.env.example')]]) {
  for (const name of envVarsSetIn(text)) {
    if (!known.has(name)) problems.push(`${file} sets ${name}, but the app never reads it.`);
  }
}

// API routes, both ways
const allRoutes = apiRoutes();
const routes = allRoutes.filter(({ takesKey }) => takesKey);
for (const { route, methods } of routes) {
  for (const method of methods) {
    const documented = [...readme.matchAll(new RegExp(`\\b${method}\\s+(${DOCUMENTED_ROUTE})`, 'g'))].some(([, r]) => sameRoute(r, route));
    if (!documented) problems.push(`${method} ${route} takes an API key, but README.md doesn't document it (as "${method} ${route.replace(/\[(.+?)\]/g, '<$1>')}").`);
  }
}
for (const [, method, documented] of readme.matchAll(new RegExp(`\\b(GET|POST|PUT|PATCH|DELETE)\\s+(${DOCUMENTED_ROUTE})`, 'g'))) {
  if (!allRoutes.some(({ route, methods }) => methods.includes(method) && sameRoute(documented, route))) {
    problems.push(`README.md documents ${method} ${documented}, but no API route answers it.`);
  }
}

// Migrations the README names
const migrations = new Set(readdirSync(path.join(root, 'prisma/migrations')));
for (const [name] of readme.matchAll(/\b\d{14}_[a-z0-9_]+\b/g)) {
  if (!migrations.has(name)) problems.push(`README.md names the migration ${name}, which isn't in prisma/migrations.`);
}

// The compose example against the Dockerfile and the repo
const dockerfile = read('Dockerfile');
const compose = readme.match(/```ya?ml\n([\s\S]*?)```/)?.[1];
if (!compose) {
  problems.push('README.md has no ```yaml compose example.');
} else {
  const exposed = dockerfile.match(/^EXPOSE\s+(\d+)/m)?.[1];
  const containerPort = compose.match(/-\s*["']?\d+:(\d+)["']?/)?.[1];
  if (exposed && containerPort !== exposed) {
    problems.push(`The compose example maps container port ${containerPort ?? '(none)'}, but the Dockerfile exposes ${exposed}.`);
  }
  const dataDir = dockerfile.match(/ENV\s+DATABASE_URL="file:(\/[^"]+)\/[^/"]+"/)?.[1];
  const volumeTarget = compose.match(/^\s*-\s*[\w.-]+:(\/[^\s:]+)/m)?.[1];
  if (dataDir && volumeTarget !== dataDir) {
    problems.push(`The compose example mounts its volume at ${volumeTarget ?? '(none)'}, but the Dockerfile keeps the database in ${dataDir}.`);
  }
  const slug = repoSlug();
  const image = compose.match(/^\s*image:\s*(\S+?)(?::[\w.-]+)?\s*$/m)?.[1];
  if (slug && image && image !== `ghcr.io/${slug}`) {
    problems.push(`The compose example uses the image ${image}, but this repo publishes ghcr.io/${slug}.`);
  }
}

if (problems.length) {
  console.error(`README.md is out of date with the code:\n\n${problems.map(p => `- ${p}`).join('\n')}\n`);
  process.exit(1);
}
console.log(`README.md matches the code: ${inCode.size} settings, ${routes.length} API routes, the migrations it names, and the compose example.`);
