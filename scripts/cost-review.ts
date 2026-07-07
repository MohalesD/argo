import { adminPool } from '../src/lib/db.js';
const pool = adminPool();
const rows = await pool.query(`
  select purpose, model, count(*)::int as calls,
         sum(tokens_in)::int as tokens_in, sum(tokens_out)::int as tokens_out,
         round(sum(cost_usd), 4) as cost_usd
  from ai_calls group by purpose, model order by cost_usd desc`);
for (const r of rows.rows) {
  console.log(`${r.purpose} | ${r.model} | calls=${r.calls} | in=${r.tokens_in} out=${r.tokens_out} | $${r.cost_usd}`);
}
const total = await pool.query('select count(*)::int as calls, round(sum(cost_usd), 4) as usd from ai_calls');
console.log(`TOTAL: ${total.rows[0].calls} calls, $${total.rows[0].usd}`);
await pool.end();
