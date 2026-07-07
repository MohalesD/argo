import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

// Loads .env.local into the config process (Node 24). Playwright
// forwards process.env to worker processes at spawn time, so
// SUPABASE_SECRET_KEY etc. reach tests/e2e/helpers/auth.ts too;
// verified empirically for this run, see .claude/handoff/navigator-e2e.md.
const envFile = path.resolve('.env.local');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    // `port`, not `url`: Playwright's url-based readiness check only
    // accepts 2xx/3xx/400-403 responses, and every route in this app
    // currently 404s (no pages exist yet, by design at this point in
    // the build), so a url check can never pass and always times out
    // at 120s. `port` just waits for the TCP port to accept
    // connections, which next dev does within a few seconds; verified
    // empirically, see .claude/handoff/navigator-e2e.md.
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
