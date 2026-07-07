// Model allowlist constraint test (PRD 4.4 layer 3, Goal 1 done
// criterion): a Mythos-tier or Fable-tier insert into ai_calls must
// fail at the database, even for privileged callers.
import { adminPool } from '../../src/lib/db.js';
import { recordEvalRun, Suite } from '../lib/harness.js';

const pool = adminPool();
const suite = new Suite('model_allowlist');

const FORBIDDEN = [
  'claude-fable-5',
  'claude-mythos-5',
  'claude-opus-4-8',
  'claude-3-opus-20240229',
];
const ALLOWED = ['claude-haiku-4-5', 'claude-sonnet-4-6'];

for (const model of FORBIDDEN) {
  let rejected = false;
  let code = '';
  try {
    await pool.query(
      "insert into ai_calls (purpose, model) values ('allowlist_test', $1)",
      [model],
    );
  } catch (err) {
    rejected = true;
    code = (err as { code?: string }).code ?? '';
  }
  suite.check(
    `insert of '${model}' rejected by CHECK constraint`,
    rejected && code === '23514',
    `sqlstate=${code || 'none'}`,
  );
}

for (const model of ALLOWED) {
  let accepted = true;
  try {
    await pool.query(
      "insert into ai_calls (purpose, model) values ('allowlist_test', $1)",
      [model],
    );
  } catch {
    accepted = false;
  }
  suite.check(`insert of allowlisted '${model}' accepted`, accepted);
}

// Constraint definition sanity: exactly the two allowlisted strings.
const def = await pool.query(
  `select pg_get_constraintdef(oid) as def
   from pg_constraint
   where conrelid = 'public.ai_calls'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%model%'`,
);
const defText: string = def.rows[0]?.def ?? '';
suite.check(
  'CHECK constraint allows exactly the two production models',
  defText.includes('claude-haiku-4-5') &&
    defText.includes('claude-sonnet-4-6') &&
    !defText.includes('fable') &&
    !defText.includes('mythos') &&
    !defText.includes('opus'),
  defText.slice(0, 120),
);

// Remove the accepted test rows so the ledger stays an honest record of
// real model calls.
await pool.query("delete from ai_calls where purpose = 'allowlist_test'");

await recordEvalRun(pool, suite, null);
await pool.end();
process.exit(suite.passed ? 0 : 1);
