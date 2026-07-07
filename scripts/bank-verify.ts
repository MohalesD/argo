// Post-seed bank verification: every question carries a screening
// status, badges are consistent, and flagged questions never surface
// to an authenticated user.
import { randomUUID } from 'node:crypto';
import { adminPool } from '../src/lib/db.js';
import { asUser, createUserWithOrg } from '../evals/lib/harness.js';

const pool = adminPool();

const flaggedRows = await pool.query(
  `select role_family, left(text, 70) as text, flag_reason
   from questions where screening_status = 'flagged' and flag_reason not like 'illegal:%'`,
);
console.log('non-plant flagged questions:');
for (const r of flaggedRows.rows) {
  console.log(`  [${r.role_family}] ${r.text}`);
  console.log(`     reason: ${r.flag_reason}`);
}

const invariants = await pool.query(`
  select
    count(*)::int as total,
    count(*) filter (where screening_status = 'pending')::int as pending,
    count(*) filter (where screening_status = 'passed' and verification is distinct from 'screened')::int as passed_unbadged,
    count(*) filter (where screening_status = 'flagged' and flag_reason is null)::int as flagged_no_reason,
    count(distinct role_family)::int as families
  from questions where provenance ->> 'source' = 'argo_seed_bank_v1'
`);
const inv = invariants.rows[0];
console.log(`\ninvariants: total=${inv.total} pending=${inv.pending} passed_unbadged=${inv.passed_unbadged} flagged_no_reason=${inv.flagged_no_reason} families=${inv.families}`);

// Surfacing rule: an authenticated user with no contributions sees only
// passed questions; flagged are invisible.
const run = randomUUID().slice(0, 8);
const viewer = await createUserWithOrg(pool, `bank_${run}@probe.test`, 'Bank', `Bank Org ${run}`);
const visible = await asUser(pool, viewer.userId, async (c) => {
  const total = await c.query('select count(*)::int as n from questions');
  const flagged = await c.query(
    "select count(*)::int as n from questions where screening_status = 'flagged'",
  );
  const badged = await c.query(
    "select count(*)::int as n from questions where verification = 'screened'",
  );
  return {
    total: total.rows[0].n as number,
    flagged: flagged.rows[0].n as number,
    badged: badged.rows[0].n as number,
  };
});
console.log(
  `\nauthenticated view: total=${visible.total} flagged_visible=${visible.flagged} screened_badged=${visible.badged}`,
);

const pass =
  inv.pending === 0 &&
  inv.passed_unbadged === 0 &&
  inv.flagged_no_reason === 0 &&
  inv.total >= 300 &&
  inv.families === 10 &&
  visible.flagged === 0 &&
  visible.total === visible.badged;
console.log(pass ? '\nBANK VERIFY: PASS' : '\nBANK VERIFY: FAIL');
await pool.end();
process.exit(pass ? 0 : 1);
