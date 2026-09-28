import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const testDbFiles = ['prisma/test.db', 'prisma/test.db-journal'].map(f => path.join(root, f));

export function setup() {
  for (const file of testDbFiles) {
    if (existsSync(file)) rmSync(file);
  }
  // Creates the schema in the fresh test database (see DATABASE_URL in vitest.config.ts).
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./prisma/test.db' },
  });
}

export function teardown() {
  for (const file of testDbFiles) {
    if (existsSync(file)) rmSync(file);
  }
}
