// Two-user RLS probe (PRD 5.1 acceptance, Goal 1 done criterion).
// Two users in two orgs; neither may read the other's org-scoped rows,
// across every table carrying org_id and the tables chained to them.
import { randomUUID } from 'node:crypto';
import { adminPool } from '../../src/lib/db.js';
import { asUser, createUserWithOrg, recordEvalRun, Suite } from '../lib/harness.js';

const pool = adminPool();
const suite = new Suite('rls_probe');
const run = randomUUID().slice(0, 8);

// Fixture: a full org-scoped object graph for one user.
async function buildOrgGraph(userId: string, orgId: string, tag: string) {
  const q = await pool.query(
    `insert into questions (text, category, role_family, level, rationale, screening_status, verification, contributed_by)
     values ($1, 'skill', 'engineering', 'mid', 'probe fixture', 'passed', 'screened', $2) returning id`,
    [`Probe question ${tag}`, userId],
  );
  const pendingQ = await pool.query(
    `insert into questions (text, category, role_family, level, screening_status, contributed_by)
     values ($1, 'skill', 'engineering', 'mid', 'pending', $2) returning id`,
    [`Pending contribution ${tag}`, userId],
  );
  const stack = await pool.query(
    `insert into qstacks (org_id, owner_id, title, visibility) values ($1, $2, $3, 'private') returning id`,
    [orgId, userId, `Private stack ${tag}`],
  );
  await pool.query(
    'insert into qstack_items (qstack_id, question_id, position) values ($1, $2, 1)',
    [stack.rows[0].id, q.rows[0].id],
  );
  const col = await pool.query(
    'insert into kanban_columns (org_id, name, position) values ($1, $2, 1) returning id',
    [orgId, `Column ${tag}`],
  );
  await pool.query(
    'insert into qstack_positions (qstack_id, column_id, position) values ($1, $2, 1)',
    [stack.rows[0].id, col.rows[0].id],
  );
  const interview = await pool.query(
    `insert into interviews (org_id, qstack_id, candidate_name, role) values ($1, $2, $3, 'Engineer') returning id`,
    [orgId, stack.rows[0].id, `Candidate ${tag}`],
  );
  const session = await pool.query(
    'insert into interview_sessions (interview_id) values ($1) returning id',
    [interview.rows[0].id],
  );
  await pool.query(
    `insert into consents (session_id, party, recorded_by) values ($1, 'interviewer', $2)`,
    [session.rows[0].id, userId],
  );
  const response = await pool.query(
    `insert into responses (session_id, question_id, response_text, created_by)
     values ($1, $2, 'captured answer', $3) returning id`,
    [session.rows[0].id, q.rows[0].id, userId],
  );
  await pool.query(
    `insert into scores (response_id, scorer_type, scorer_id, value, anchor)
     values ($1, 'human', $2, 3, 'meets bar')`,
    [response.rows[0].id, userId],
  );
  const brief = await pool.query(
    `insert into briefs (interview_id, content) values ($1, '{"summary": "probe"}') returning id`,
    [interview.rows[0].id],
  );
  await pool.query(
    'insert into brief_shares (brief_id, created_by) values ($1, $2)',
    [brief.rows[0].id, userId],
  );
  await pool.query(
    `insert into profiles (user_id, handle, display_name, visibility) values ($1, $2, $3, 'private')`,
    [userId, `handle_${tag}_${run}`, `User ${tag}`],
  );
  await pool.query(
    `insert into notifications (user_id, type, payload) values ($1, 'probe', '{}')`,
    [userId],
  );
  return {
    orgId,
    qstackId: stack.rows[0].id as string,
    interviewId: interview.rows[0].id as string,
    sessionId: session.rows[0].id as string,
    responseId: response.rows[0].id as string,
    briefId: brief.rows[0].id as string,
    pendingQuestionId: pendingQ.rows[0].id as string,
  };
}

const alpha = await createUserWithOrg(pool, `alpha_${run}@probe.test`, 'Alpha', `Org Alpha ${run}`);
const beta = await createUserWithOrg(pool, `beta_${run}@probe.test`, 'Beta', `Org Beta ${run}`);
const alphaGraph = await buildOrgGraph(alpha.userId, alpha.orgId, `A${run}`);
const betaGraph = await buildOrgGraph(beta.userId, beta.orgId, `B${run}`);

interface Probe {
  name: string;
  sql: string;
  params: (g: Awaited<ReturnType<typeof buildOrgGraph>>, other: { userId: string }) => unknown[];
}

// Each probe counts rows the user should NOT be able to see. 0 = pass.
const crossOrgProbes: Probe[] = [
  { name: 'orgs', sql: 'select count(*)::int as n from orgs where id = $1', params: (g) => [g.orgId] },
  { name: 'org_members', sql: 'select count(*)::int as n from org_members where org_id = $1', params: (g) => [g.orgId] },
  { name: 'qstacks', sql: 'select count(*)::int as n from qstacks where org_id = $1', params: (g) => [g.orgId] },
  { name: 'kanban_columns', sql: 'select count(*)::int as n from kanban_columns where org_id = $1', params: (g) => [g.orgId] },
  { name: 'interviews', sql: 'select count(*)::int as n from interviews where org_id = $1', params: (g) => [g.orgId] },
  { name: 'qstack_positions', sql: 'select count(*)::int as n from qstack_positions where qstack_id = $1', params: (g) => [g.qstackId] },
  { name: 'qstack_items', sql: 'select count(*)::int as n from qstack_items where qstack_id = $1', params: (g) => [g.qstackId] },
  { name: 'interview_sessions', sql: 'select count(*)::int as n from interview_sessions where interview_id = $1', params: (g) => [g.interviewId] },
  { name: 'consents', sql: 'select count(*)::int as n from consents where session_id = $1', params: (g) => [g.sessionId] },
  { name: 'responses', sql: 'select count(*)::int as n from responses where session_id = $1', params: (g) => [g.sessionId] },
  { name: 'scores', sql: 'select count(*)::int as n from scores where response_id = $1', params: (g) => [g.responseId] },
  { name: 'briefs', sql: 'select count(*)::int as n from briefs where interview_id = $1', params: (g) => [g.briefId === '' ? '' : g.interviewId] },
  { name: 'brief_shares', sql: 'select count(*)::int as n from brief_shares where brief_id = $1', params: (g) => [g.briefId] },
  { name: 'private_profile', sql: 'select count(*)::int as n from profiles where user_id = $1', params: (_g, other) => [other.userId] },
  { name: 'notifications', sql: 'select count(*)::int as n from notifications where user_id = $1', params: (_g, other) => [other.userId] },
  { name: 'pending_questions', sql: 'select count(*)::int as n from questions where id = $1', params: (g) => [g.pendingQuestionId] },
];

async function probeDirection(
  label: string,
  viewer: { userId: string },
  targetGraph: Awaited<ReturnType<typeof buildOrgGraph>>,
  targetUser: { userId: string },
): Promise<void> {
  for (const probe of crossOrgProbes) {
    const n = await asUser(pool, viewer.userId, async (c) => {
      const r = await c.query(probe.sql, probe.params(targetGraph, targetUser));
      return r.rows[0].n as number;
    });
    suite.check(`${label}: ${probe.name} cross-org rows invisible`, n === 0, `saw ${n}`);
  }
}

console.log('RLS probe: alpha reading beta');
await probeDirection('alpha->beta', alpha, betaGraph, beta);
console.log('RLS probe: beta reading alpha');
await probeDirection('beta->alpha', beta, alphaGraph, alpha);

// Positive controls: RLS is not simply denying everything.
const ownQstacks = await asUser(pool, alpha.userId, async (c) => {
  const r = await c.query('select count(*)::int as n from qstacks where org_id = $1', [alpha.orgId]);
  return r.rows[0].n as number;
});
suite.check('positive control: alpha sees own org qstacks', ownQstacks === 1, `saw ${ownQstacks}`);

const ownSession = await asUser(pool, alpha.userId, async (c) => {
  const r = await c.query('select count(*)::int as n from interview_sessions where id = $1', [alphaGraph.sessionId]);
  return r.rows[0].n as number;
});
suite.check('positive control: alpha sees own session', ownSession === 1, `saw ${ownSession}`);

// Cross-user writes must also fail: beta cannot insert into alpha's org.
const writeBlocked = await asUser(pool, beta.userId, async (c) => {
  try {
    await c.query(
      `insert into qstacks (org_id, owner_id, title) values ($1, $2, 'intrusion')`,
      [alpha.orgId, beta.userId],
    );
    return false;
  } catch {
    return true;
  }
});
suite.check('write probe: beta cannot insert qstack into alpha org', writeBlocked);

await recordEvalRun(pool, suite, null);
await pool.end();
process.exit(suite.passed ? 0 : 1);
