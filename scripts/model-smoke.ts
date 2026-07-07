// Transport smoke test: prove the registry rejects disallowed models
// in-process, and that a real Haiku call round-trips and lands in
// ai_calls with cost accounting.
import { adminPool } from '../src/lib/db.js';
import { assertAllowedModel } from '../src/lib/models.js';
import { callModel, getTransport } from '../src/lib/registry.js';

let rejected = false;
try {
  assertAllowedModel('claude-fable-5');
} catch {
  rejected = true;
}
console.log(`registry rejects claude-fable-5 in-process: ${rejected ? 'PASS' : 'FAIL'}`);
if (!rejected) process.exit(1);

const pool = adminPool();
console.log(`transport: ${getTransport().name}`);
const res = await callModel(pool, 'transport_smoke_test', {
  prompt: 'Reply with exactly the word OK and nothing else.',
  maxTokens: 16,
});
console.log(`haiku replied: ${JSON.stringify(res.text.trim())} (in=${res.tokensIn}, out=${res.tokensOut})`);

const row = await pool.query(
  "select model, cost_usd from ai_calls where purpose = 'transport_smoke_test' order by created_at desc limit 1",
);
console.log(`ai_calls row: model=${row.rows[0]?.model}, cost_usd=${row.rows[0]?.cost_usd}`);
await pool.end();
process.exit(res.text.trim().length > 0 && row.rows.length === 1 ? 0 : 1);
