// Boots a fresh embedded Postgres from zero: wipes the data directory,
// initializes, starts, creates the argo database, applies the local
// Supabase shim, then applies every migration in order. Stays alive so
// eval suites and seeds can connect; stop with SIGINT/SIGTERM.
import EmbeddedPostgres from 'embedded-postgres';
import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { DB_CONFIG } from '../src/lib/db.js';

const DATA_DIR = path.resolve('.pgdata');
const MIGRATIONS_DIR = path.resolve('supabase', 'migrations');

async function applySqlFile(client: pg.Client, filePath: string): Promise<void> {
  const sql = await readFile(filePath, 'utf8');
  await client.query(sql);
}

async function main(): Promise<void> {
  await rm(DATA_DIR, { recursive: true, force: true });

  const server = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    port: DB_CONFIG.port,
    persistent: false,
  });

  await server.initialise();
  await server.start();
  await server.createDatabase(DB_CONFIG.database);

  const client = new pg.Client(DB_CONFIG);
  await client.connect();

  await applySqlFile(client, path.resolve('db', 'shim.sql'));
  console.log('shim applied');

  let migrations: string[] = [];
  try {
    migrations = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  } catch {
    console.log('no migrations directory yet');
  }
  for (const file of migrations) {
    await applySqlFile(client, path.join(MIGRATIONS_DIR, file));
    console.log(`applied ${file}`);
  }

  await client.end();
  console.log(`READY on port ${DB_CONFIG.port} (${migrations.length} migrations)`);

  const stop = async () => {
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
