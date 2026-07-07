import pg from 'pg';

// Server-side pg pool against the hosted database, used only where a
// direct connection is required: ai_calls logging (no RLS path for
// users by design) and service-side question promotion. Reused across
// hot reloads via globalThis.
const globalForPool = globalThis as unknown as { argoPool?: pg.Pool };

export function serverPool(): pg.Pool {
  if (!globalForPool.argoPool) {
    const url = process.env.DATABASE_URL_HOSTED;
    if (!url) throw new Error('DATABASE_URL_HOSTED is not set');
    globalForPool.argoPool = new pg.Pool({
      connectionString: url,
      max: 3,
      ssl: { rejectUnauthorized: false },
    });
  }
  return globalForPool.argoPool;
}
