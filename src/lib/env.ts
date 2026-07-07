import { existsSync } from 'node:fs';
import path from 'node:path';

// Loads .env.local once for scripts, seeds, and eval suites. Values
// already present in the environment win, so a per-invocation
// DATABASE_URL override still targets a different database.
const envFile = path.resolve('.env.local');
if (existsSync(envFile)) {
  const before = { ...process.env };
  process.loadEnvFile(envFile);
  for (const key of Object.keys(process.env)) {
    if (before[key] !== undefined) process.env[key] = before[key];
  }
}

// ARGO_DB=hosted retargets everything that reads DATABASE_URL at the
// hosted Supabase project, without secrets ever crossing a command line.
if (process.env.ARGO_DB === 'hosted') {
  if (!process.env.DATABASE_URL_HOSTED) {
    throw new Error('ARGO_DB=hosted but DATABASE_URL_HOSTED is not set in .env.local');
  }
  process.env.DATABASE_URL = process.env.DATABASE_URL_HOSTED;
}
