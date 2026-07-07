// Eval suite 8.5, consent enforcement (PRD Section 8.5).
// An interview session cannot reach 'capturing' without a consent
// record, attempted via the authenticated RLS path and via the
// privileged service path; both must fail. The legitimate consented
// path must succeed. The UI path does not exist until Goal 2 and is
// recorded in the build log's could-not-verify section.
import { randomUUID } from 'node:crypto';
import { adminPool } from '../../src/lib/db.js';
import { asUser, createUserWithOrg, recordEvalRun, Suite } from '../lib/harness.js';

const pool = adminPool();
const suite = new Suite('consent_8_5');
const run = randomUUID().slice(0, 8);

const { userId, orgId } = await createUserWithOrg(
  pool,
  `consent_${run}@probe.test`,
  'Consent',
  `Consent Org ${run}`,
);
const q = await pool.query(
  `insert into questions (text, category, role_family, level, screening_status, flag_reason, verification)
   values ('Consent probe question', 'skill', 'engineering', 'mid', 'flagged', 'suite fixture, not bank content', null) returning id`,
);
const stack = await pool.query(
  `insert into qstacks (org_id, owner_id, title) values ($1, $2, 'Consent stack') returning id`,
  [orgId, userId],
);
const interview = await pool.query(
  `insert into interviews (org_id, qstack_id, candidate_name, role)
   values ($1, $2, 'Probe Candidate', 'Engineer') returning id`,
  [orgId, stack.rows[0].id],
);

async function newSession(): Promise<string> {
  const s = await pool.query(
    'insert into interview_sessions (interview_id) values ($1) returning id',
    [interview.rows[0].id],
  );
  return s.rows[0].id as string;
}

// 1. Authenticated user (RLS path): created -> capturing must fail.
const s1 = await newSession();
const userJump = await asUser(
  pool,
  userId,
  async (c) => {
    try {
      await c.query("update interview_sessions set state = 'capturing' where id = $1", [s1]);
      return 'allowed';
    } catch (err) {
      return (err as Error).message;
    }
  },
  { commit: true },
);
suite.check(
  'authenticated user cannot jump created -> capturing',
  userJump !== 'allowed',
  userJump.slice(0, 70),
);

// 2. Authenticated user: created -> consented without a consent record must fail.
const noConsent = await asUser(
  pool,
  userId,
  async (c) => {
    try {
      await c.query("update interview_sessions set state = 'consented' where id = $1", [s1]);
      return 'allowed';
    } catch (err) {
      return (err as Error).message;
    }
  },
  { commit: true },
);
suite.check(
  'consented state requires a stored consent record',
  noConsent !== 'allowed',
  noConsent.slice(0, 70),
);

// 3. Privileged service path (superuser, RLS bypassed): the trigger must
//    still block created -> capturing. This is the direct API attempt.
const s2 = await newSession();
let serviceJump = 'allowed';
try {
  await pool.query("update interview_sessions set state = 'capturing' where id = $1", [s2]);
} catch (err) {
  serviceJump = (err as Error).message;
}
suite.check(
  'privileged service path cannot jump created -> capturing',
  serviceJump !== 'allowed',
  serviceJump.slice(0, 70),
);

// 4. Sessions cannot be born past 'created'.
let bornCapturing = 'allowed';
try {
  await pool.query(
    "insert into interview_sessions (interview_id, state) values ($1, 'capturing')",
    [interview.rows[0].id],
  );
} catch (err) {
  bornCapturing = (err as Error).message;
}
suite.check('sessions cannot be inserted in state capturing', bornCapturing !== 'allowed');

let bornConsented = 'allowed';
try {
  await pool.query(
    "insert into interview_sessions (interview_id, state) values ($1, 'consented')",
    [interview.rows[0].id],
  );
} catch (err) {
  bornConsented = (err as Error).message;
}
suite.check('sessions cannot be inserted in state consented', bornConsented !== 'allowed');

// 5. The legitimate path succeeds: consent record -> consented ->
//    capturing -> ended, as the authenticated user.
const s3 = await newSession();
const legitimate = await asUser(
  pool,
  userId,
  async (c) => {
    await c.query(
      `insert into consents (session_id, party, method, recorded_by)
       values ($1, 'interviewer', 'verbal_confirmation', $2),
              ($1, 'candidate', 'verbal_confirmation', $2)`,
      [s3, userId],
    );
    await c.query("update interview_sessions set state = 'consented' where id = $1", [s3]);
    await c.query("update interview_sessions set state = 'capturing' where id = $1", [s3]);
    const r = await c.query('select state, started_at from interview_sessions where id = $1', [s3]);
    return r.rows[0] as { state: string; started_at: Date | null };
  },
  { commit: true },
);
suite.check(
  'legitimate consented path reaches capturing',
  legitimate.state === 'capturing',
  `state=${legitimate.state}`,
);
suite.check('started_at stamped on capture start', legitimate.started_at !== null);

// 6. Ended is terminal.
await pool.query("update interview_sessions set state = 'ended' where id = $1", [s3]);
let reopened = 'allowed';
try {
  await pool.query("update interview_sessions set state = 'capturing' where id = $1", [s3]);
} catch (err) {
  reopened = (err as Error).message;
}
suite.check('ended sessions cannot re-enter capturing', reopened !== 'allowed');

// 7. Consent gate double-checks the record itself on -> capturing:
//    verified structurally by the trigger body; behaviorally, a session
//    whose consents were deleted cannot advance. Consents cascade only
//    on session delete; simulate by removing rows as admin.
const s4 = await newSession();
await pool.query(
  `insert into consents (session_id, party, recorded_by) values ($1, 'interviewer', $2)`,
  [s4, userId],
);
await pool.query("update interview_sessions set state = 'consented' where id = $1", [s4]);
await pool.query('delete from consents where session_id = $1', [s4]);
let staleConsent = 'allowed';
try {
  await pool.query("update interview_sessions set state = 'capturing' where id = $1", [s4]);
} catch (err) {
  staleConsent = (err as Error).message;
}
suite.check(
  'capture re-verifies the consent record exists at transition time',
  staleConsent !== 'allowed',
);

await recordEvalRun(pool, suite, null);
await pool.end();
process.exit(suite.passed ? 0 : 1);
