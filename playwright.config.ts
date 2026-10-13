import { defineConfig } from '@playwright/test';

// End-to-end tests start the built app (npm run build first; npm run test:e2e does both).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'retain-on-failure' }
});
