// Starts the embedded Postgres server against the EXISTING data
// directory without wiping it. Use db:fresh for a from-zero rebuild;
// use this to bring the already-seeded database back up.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DB_CONFIG } from '../src/lib/db.js';

const DATA_DIR = path.resolve('.pgdata');

if (!existsSync(DATA_DIR)) {
  console.error('No .pgdata directory found. Run `npm run db:fresh` first.');
  process.exit(1);
}

const server = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: DB_CONFIG.user,
  password: DB_CONFIG.password,
  port: DB_CONFIG.port,
  persistent: false,
});

await server.start();
console.log(`READY on port ${DB_CONFIG.port} (existing data preserved)`);

const stop = async () => {
  await server.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
