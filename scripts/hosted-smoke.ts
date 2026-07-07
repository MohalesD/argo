// One-time connectivity smoke against the hosted project: confirms the
// pooler connection, the RLS test pattern (set local role), and that
// the migrations landed. Prints no secrets.
import { adminPool } from '../src/lib/db.js';

const pool = adminPool();
const who = await pool.query('select current_user, current_database()');
console.log('connected as:', who.rows[0].current_user, '/', who.rows[0].current_database);

const tables = await pool.query(
  `select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
);
console.log('public tables:', tables.rows[0].n);

const client = await pool.connect();
try {
  await client.query('begin');
  await client.query('set local role authenticated');
  const role = await client.query('select current_user');
  console.log('set role authenticated:', role.rows[0].current_user);
  await client.query('rollback');
} finally {
  client.release();
}

await pool.end();
console.log('hosted smoke OK');
