import { adminPool } from '../src/lib/db.js';
const pool = adminPool();
const rows = await pool.query(`
  select distinct on (suite) suite, model, passed, ran_at
  from eval_runs order by suite, ran_at desc`);
for (const r of rows.rows) {
  console.log(`${r.suite} | passed=${r.passed} | model=${r.model ?? '-'} | ${r.ran_at.toISOString()}`);
}
await pool.end();
