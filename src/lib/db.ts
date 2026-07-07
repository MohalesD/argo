import pg from 'pg';
import './env.js';

// Connection settings for the local embedded Postgres used across
// scripts, seeds, and eval suites. scripts/db-fresh.ts boots this server.
export const DB_CONFIG = {
  host: '127.0.0.1',
  port: 5799,
  database: 'argo',
  user: 'postgres',
  password: 'postgres',
} as const;

// DATABASE_URL (env or .env.local) targets a different database, e.g.
// the hosted Supabase project; the embedded default keeps local runs
// working with zero configuration.
export function adminPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (url && !url.includes('127.0.0.1:5799')) {
    return new pg.Pool({
      connectionString: url,
      max: 5,
      ssl: { rejectUnauthorized: false },
    });
  }
  return new pg.Pool({ ...DB_CONFIG, max: 5 });
}
