import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    env: {
      // A dedicated sqlite file so tests never touch the dev database.
      DATABASE_URL: 'file:./prisma/test.db',
      // Self-hosted unless a test says otherwise, whatever a developer's .env has (e.g. cloud, for
      // trying Google sign-in)
      DEPLOYMENT_MODE: 'selfhost',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
