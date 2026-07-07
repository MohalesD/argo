// Anon-browse eval suite (Goal 1 watched item): confirms the marketplace
// anon-browse RLS policies (0007_rls_policies.sql) match the Goal 2
// signed-out surface design (PRD 5.9, 5.10) before anon read is exposed
// publicly. Allowed: public qstacks, their items, passed questions,
// public profiles and their posts, listings on public qstacks. Forbidden:
// everything else, plus any anon write.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { adminPool } from '../../src/lib/db.js';
import { createUserWithOrg, recordEvalRun, Suite } from '../lib/harness.js';

const pool = adminPool();
const suite = new Suite('anon_browse');
const run = randomUUID().slice(0, 8);
const tag = `anonprobe_${run}`;

// Runs fn as the anon role: SET LOCAL ROLE with no JWT claims at all,
// exactly the signed-out PostgREST path. Always rolled back: read probes
// need no commit, and write probes must never actually land.
async function asAnon<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role anon');
    const result = await fn(client);
    await client.query('rollback');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function countAsAnon(sql: string, params: unknown[]): Promise<number> {
  return asAnon(async (c) => {
    const r = await c.query(sql, params);
    return r.rows[0].n as number;
  });
}

async function writeBlockedAsAnon(sql: string, params: unknown[]): Promise<{ blocked: boolean; detail: string }> {
  return asAnon(async (c) => {
    try {
      await c.query(sql, params);
      return { blocked: false, detail: 'insert was not blocked' };
    } catch (err) {
      return { blocked: true, detail: (err as Error).message.slice(0, 70) };
    }
  });
}

// --- Fixtures, built as admin (superuser bypasses RLS). ---------------

const owner = await createUserWithOrg(pool, `${tag}_owner@probe.test`, 'AnonProbeOwner', `Anonprobe Owner Org ${run}`);
const pubUser = await createUserWithOrg(pool, `${tag}_pub@probe.test`, 'AnonProbePublic', `Anonprobe Pub Org ${run}`);
const privUser = await createUserWithOrg(pool, `${tag}_priv@probe.test`, 'AnonProbePrivate', `Anonprobe Priv Org ${run}`);

// Reuse an existing passed bank question rather than birthing one; a
// fixture question we create ourselves must never be born 'passed'.
const passedQRes = await pool.query(
  "select id from questions where screening_status = 'passed' limit 1",
);
if (passedQRes.rows.length === 0) {
  throw new Error('no passed bank question found; run npm run seed before this suite');
}
const passedQuestionId: string = passedQRes.rows[0].id;

const publicQstack = await pool.query(
  `insert into qstacks (org_id, owner_id, title, visibility) values ($1, $2, $3, 'public') returning id`,
  [owner.orgId, owner.userId, `Anonprobe public stack ${run}`],
);
const publicQstackId: string = publicQstack.rows[0].id;

const privateQstack = await pool.query(
  `insert into qstacks (org_id, owner_id, title, visibility) values ($1, $2, $3, 'private') returning id`,
  [owner.orgId, owner.userId, `Anonprobe private stack ${run}`],
);
const privateQstackId: string = privateQstack.rows[0].id;

const orgQstack = await pool.query(
  `insert into qstacks (org_id, owner_id, title, visibility) values ($1, $2, $3, 'org') returning id`,
  [owner.orgId, owner.userId, `Anonprobe org-visibility stack ${run}`],
);
const orgQstackId: string = orgQstack.rows[0].id;

for (const qstackId of [publicQstackId, privateQstackId, orgQstackId]) {
  await pool.query(
    'insert into qstack_items (qstack_id, question_id, position) values ($1, $2, 1)',
    [qstackId, passedQuestionId],
  );
}

const publicListing = await pool.query(
  'insert into marketplace_listings (qstack_id, price_cents) values ($1, 500) returning id',
  [publicQstackId],
);
const privateListing = await pool.query(
  'insert into marketplace_listings (qstack_id, price_cents) values ($1, 500) returning id',
  [privateQstackId],
);

// Fixture questions must not be born passed: one flagged, one pending.
const flaggedQ = await pool.query(
  `insert into questions (text, category, role_family, level, screening_status, flag_reason, verification, contributed_by)
   values ($1, 'skill', 'engineering', 'mid', 'flagged', 'suite fixture, not bank content', null, $2) returning id`,
  [`Anonprobe flagged fixture ${run}`, owner.userId],
);
const pendingQ = await pool.query(
  `insert into questions (text, category, role_family, level, screening_status, contributed_by)
   values ($1, 'skill', 'engineering', 'mid', 'pending', $2) returning id`,
  [`Anonprobe pending fixture ${run}`, owner.userId],
);

const publicProfile = await pool.query(
  `insert into profiles (user_id, handle, display_name, visibility) values ($1, $2, $3, 'public') returning id`,
  [pubUser.userId, `${tag}_pub_handle`, 'Anonprobe Public Profile'],
);
const privateProfile = await pool.query(
  `insert into profiles (user_id, handle, display_name, visibility) values ($1, $2, $3, 'private') returning id`,
  [privUser.userId, `${tag}_priv_handle`, 'Anonprobe Private Profile'],
);

const publicPost = await pool.query(
  'insert into posts (author_id, body) values ($1, $2) returning id',
  [pubUser.userId, `Anonprobe public post ${run}`],
);
const privatePost = await pool.query(
  'insert into posts (author_id, body) values ($1, $2) returning id',
  [privUser.userId, `Anonprobe private post ${run}`],
);

// --- Allowed reads: the signed-out surface. ----------------------------

suite.check(
  'allowed: public qstack is readable',
  (await countAsAnon('select count(*)::int as n from qstacks where id = $1', [publicQstackId])) === 1,
);
suite.check(
  'allowed: qstack_items of the public qstack are readable',
  (await countAsAnon('select count(*)::int as n from qstack_items where qstack_id = $1', [publicQstackId])) === 1,
);
suite.check(
  'allowed: a passed bank question is readable',
  (await countAsAnon('select count(*)::int as n from questions where id = $1', [passedQuestionId])) === 1,
);
suite.check(
  'allowed: public profile is readable',
  (await countAsAnon('select count(*)::int as n from profiles where id = $1', [publicProfile.rows[0].id])) === 1,
);
suite.check(
  'allowed: post of a public-profile author is readable',
  (await countAsAnon('select count(*)::int as n from posts where id = $1', [publicPost.rows[0].id])) === 1,
);
suite.check(
  'allowed: marketplace listing on the public qstack is readable',
  (await countAsAnon('select count(*)::int as n from marketplace_listings where id = $1', [publicListing.rows[0].id])) === 1,
);

// --- Forbidden reads: everything else, zero rows counts as blocked. ---

const forbiddenScoped: Array<{ name: string; sql: string; params: unknown[] }> = [
  { name: 'private qstack is not readable', sql: 'select count(*)::int as n from qstacks where id = $1', params: [privateQstackId] },
  { name: 'org-visibility qstack is not readable', sql: 'select count(*)::int as n from qstacks where id = $1', params: [orgQstackId] },
  { name: 'qstack_items of the private qstack are not readable', sql: 'select count(*)::int as n from qstack_items where qstack_id = $1', params: [privateQstackId] },
  { name: 'qstack_items of the org-visibility qstack are not readable', sql: 'select count(*)::int as n from qstack_items where qstack_id = $1', params: [orgQstackId] },
  { name: 'flagged question is not readable', sql: 'select count(*)::int as n from questions where id = $1', params: [flaggedQ.rows[0].id] },
  { name: 'pending question is not readable', sql: 'select count(*)::int as n from questions where id = $1', params: [pendingQ.rows[0].id] },
  { name: 'private profile is not readable', sql: 'select count(*)::int as n from profiles where id = $1', params: [privateProfile.rows[0].id] },
  { name: 'post of a private-profile author is not readable', sql: 'select count(*)::int as n from posts where id = $1', params: [privatePost.rows[0].id] },
  { name: 'orgs row is not readable', sql: 'select count(*)::int as n from orgs where id = $1', params: [owner.orgId] },
  { name: 'org_members rows are not readable', sql: 'select count(*)::int as n from org_members where org_id = $1', params: [owner.orgId] },
  { name: 'users row is not readable', sql: 'select count(*)::int as n from users where id = $1', params: [owner.userId] },
  { name: 'listing on the private qstack is not readable', sql: 'select count(*)::int as n from marketplace_listings where id = $1', params: [privateListing.rows[0].id] },
];
for (const probe of forbiddenScoped) {
  const n = await countAsAnon(probe.sql, probe.params);
  suite.check(`forbidden: ${probe.name}`, n === 0, `saw ${n}`);
}

// Tables with zero anon policies: RLS blocks every row regardless of
// content, so a blanket count is a valid, robust probe (no fixture rows
// of these types are needed or created by this suite).
const forbiddenBlanket = [
  'interviews',
  'interview_sessions',
  'consents',
  'responses',
  'scores',
  'mentions',
  'briefs',
  'brief_shares',
  'invites',
  'notifications',
  'ai_calls',
  'eval_runs',
];
for (const table of forbiddenBlanket) {
  const n = await countAsAnon(`select count(*)::int as n from ${table}`, []);
  suite.check(`forbidden: ${table} table is fully blocked to anon`, n === 0, `saw ${n}`);
}

// --- Forbidden writes: anon has table grants but no matching policy. --

const writes: Array<{ name: string; sql: string; params: unknown[] }> = [
  {
    name: 'anon cannot insert a qstack',
    sql: `insert into qstacks (org_id, owner_id, title) values ($1, $2, 'anon intrusion stack')`,
    params: [owner.orgId, owner.userId],
  },
  {
    name: 'anon cannot insert a question',
    sql: `insert into questions (text, category, role_family, level, screening_status, contributed_by)
          values ('anon intrusion question', 'skill', 'engineering', 'mid', 'pending', $1)`,
    params: [owner.userId],
  },
  {
    name: 'anon cannot insert a star',
    sql: 'insert into stars (user_id, qstack_id) values ($1, $2)',
    params: [owner.userId, publicQstackId],
  },
  {
    name: 'anon cannot insert a post',
    sql: "insert into posts (author_id, body) values ($1, 'anon intrusion post')",
    params: [owner.userId],
  },
];
for (const w of writes) {
  const result = await writeBlockedAsAnon(w.sql, w.params);
  suite.check(`forbidden: ${w.name}`, result.blocked, result.detail);
}

await recordEvalRun(pool, suite, null);

// --- Cleanup: fixture rows only. Tolerate failures silently; never work
// around a trigger to force a delete through. ---------------------------
try {
  await pool.query('delete from questions where id = any($1::uuid[])', [
    [flaggedQ.rows[0].id, pendingQ.rows[0].id],
  ]);
  await pool.query('delete from orgs where id = any($1::uuid[])', [
    [owner.orgId, pubUser.orgId, privUser.orgId],
  ]);
  await pool.query('delete from auth.users where id = any($1::uuid[])', [
    [owner.userId, pubUser.userId, privUser.userId],
  ]);
} catch (err) {
  console.log(`cleanup: some anonprobe fixture rows could not be removed (${(err as Error).message.slice(0, 160)})`);
}

await pool.end();
process.exit(suite.passed ? 0 : 1);
