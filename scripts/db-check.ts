// Quick structural sanity report on the running local database.
import { adminPool } from '../src/lib/db.js';

const pool = adminPool();
const tables = await pool.query(
  "select count(*)::int as n from pg_tables where schemaname = 'public'",
);
const rls = await pool.query(
  "select count(*)::int as n from pg_tables where schemaname = 'public' and rowsecurity",
);
const policies = await pool.query(
  "select count(*)::int as n from pg_policies where schemaname = 'public'",
);
const noRls = await pool.query(
  "select tablename from pg_tables where schemaname = 'public' and not rowsecurity",
);
console.log(
  `tables: ${tables.rows[0].n} | rls-enabled: ${rls.rows[0].n} | policies: ${policies.rows[0].n}`,
);
if (noRls.rows.length > 0) {
  console.log('tables WITHOUT rls:', noRls.rows.map((r) => r.tablename).join(', '));
}
await pool.end();
