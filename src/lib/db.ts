import pg from 'pg';

// Connection settings for the local embedded Postgres used across
// scripts, seeds, and eval suites. scripts/db-fresh.ts boots this server.
export const DB_CONFIG = {
  host: '127.0.0.1',
  port: 5799,
  database: 'argo',
  user: 'postgres',
  password: 'postgres',
} as const;

export function adminPool(): pg.Pool {
  return new pg.Pool({ ...DB_CONFIG, max: 5 });
}
