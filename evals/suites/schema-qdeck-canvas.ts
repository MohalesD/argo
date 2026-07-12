// TDD failing-test suite for the QDeck / canvas-position schema work
// (not yet built as of this writing). Follows the rls-probe.ts /
// anon-browse.ts house pattern: standalone tsx script, per-check console
// output, nonzero exit on any failure, results persisted to eval_runs.
//
// Acceptance criteria under test:
// 1. public.qstacks gains a real, stored `stage` column (text, not null,
//    default '').
// 2. New table public.qdecks, org-scoped, RLS enabled.
// 3. public.qstacks gains a nullable `deck_id`; cross-org assignment is
//    rejected at the database layer even for the table owner; deleting a
//    deck loosens (nulls) member stacks rather than deleting them.
// 4. New table public.canvas_positions: XOR subject (qstack_id XOR
//    deck_id), one position per subject, cascades on subject delete,
//    survives deck membership changes untouched, RLS org-scoped.
// 5. Regression guard: public.stars already enforces one star per
//    (user_id, qstack_id). This table exists today; this check is
//    expected to PASS now and stay green after the migration lands.
//
// Every check for criteria 1-4 is expected to FAIL right now with a
// missing-table / missing-column / missing-constraint error. A check
// that already reports PASS before the migration exists is a test bug,
// not a real result -- see the `scenario` / `expectReject` helpers below
// for how false positives are avoided.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { adminPool } from '../../src/lib/db.js';
import { asUser, createUserWithOrg, recordEvalRun, Suite } from '../lib/harness.js';

const pool = adminPool();
const suite = new Suite('schema_qdeck_canvas');
const run = randomUUID().slice(0, 8);

// --- Local helpers -----------------------------------------------------

// Runs fn as the anon role: SET LOCAL ROLE with no JWT claims, exactly
// the signed-out PostgREST path. Always rolled back. Mirrors
// anon-browse.ts's local asAnon.
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

async function countAsUser(userId: string, table: string, idColumn: string, idValue: string): Promise<number> {
  return asUser(pool, userId, async (c) => {
    const r = await c.query(`select count(*)::int as n from ${table} where ${idColumn} = $1`, [idValue]);
    return r.rows[0].n as number;
  });
}

// Runs a whole check scenario (fixture setup, action, post-condition
// assertion) as one unit. ANY throw anywhere in fn -- including a
// missing-table error during setup -- fails the check with that error
// as the detail. This is deliberate: right now setup itself throws
// (relation does not exist), which is a valid failure reason for every
// check under criteria 1-4, not just the ones that directly touch the
// new tables.
async function scenario(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    suite.check(name, true);
  } catch (err) {
    suite.check(name, false, (err as Error).message.slice(0, 140));
  }
}

// Postgres error codes for undefined_table / undefined_column: the
// operation never reached the constraint under test at all.
const SCHEMA_MISSING_CODES = new Set(['42P01', '42703']);

// Runs action() and requires it to throw (a database rejection). If it
// resolves instead, that is itself a failure, surfaced by throwing a
// distinctive error that scenario() will report. Critically, a rejection
// caused by a missing table/column (SCHEMA_MISSING_CODES) is NOT treated
// as the expected rejection -- it is re-thrown so scenario() reports the
// real reason. Without this, a check like "insert requires ownership"
// would falsely report PASS right now merely because the table doesn't
// exist yet, before the ownership rule has been evaluated at all.
async function expectReject(action: () => Promise<unknown>, label: string): Promise<void> {
  let succeeded = false;
  try {
    await action();
    succeeded = true;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code && SCHEMA_MISSING_CODES.has(code)) {
      throw err;
    }
    // Otherwise: the database rejected the operation for the reason
    // under test (RLS policy, check constraint, unique, FK, etc). Expected.
  }
  if (succeeded) {
    throw new Error(`${label}: expected the database to reject this, but it succeeded`);
  }
}

async function createDeckAsAdmin(orgId: string, ownerId: string, title: string): Promise<string> {
  const r = await pool.query(
    `insert into qdecks (org_id, owner_id, title) values ($1, $2, $3) returning id`,
    [orgId, ownerId, title],
  );
  return r.rows[0].id as string;
}

async function createStack(orgId: string, ownerId: string, title: string, extra: { visibility?: string } = {}): Promise<string> {
  if (extra.visibility) {
    const r = await pool.query(
      `insert into qstacks (org_id, owner_id, title, visibility) values ($1, $2, $3, $4) returning id`,
      [orgId, ownerId, title, extra.visibility],
    );
    return r.rows[0].id as string;
  }
  const r = await pool.query(
    `insert into qstacks (org_id, owner_id, title) values ($1, $2, $3) returning id`,
    [orgId, ownerId, title],
  );
  return r.rows[0].id as string;
}

// --- Fixtures: two orgs, existing schema only. --------------------------

const alpha = await createUserWithOrg(pool, `alpha_${run}@qdeckprobe.test`, 'Alpha', `QDeck Org Alpha ${run}`);
const beta = await createUserWithOrg(pool, `beta_${run}@qdeckprobe.test`, 'Beta', `QDeck Org Beta ${run}`);

// =========================================================================
// Criterion 1: qstacks.stage
// =========================================================================

console.log('Criterion 1: qstacks.stage');

const stageCol = (
  await pool.query(
    `select data_type, is_nullable, column_default, is_generated
     from information_schema.columns
     where table_schema = 'public' and table_name = 'qstacks' and column_name = 'stage'`,
  )
).rows[0] as { data_type: string; is_nullable: string; column_default: string | null; is_generated: string } | undefined;

suite.check('qstacks.stage column exists (information_schema)', !!stageCol, stageCol ? undefined : 'no matching information_schema.columns row');
suite.check('qstacks.stage is type text', stageCol?.data_type === 'text', stageCol?.data_type ?? 'column missing');
suite.check('qstacks.stage is NOT NULL', stageCol?.is_nullable === 'NO', stageCol?.is_nullable ?? 'column missing');
suite.check("qstacks.stage defaults to ''", stageCol?.column_default === "''::text", stageCol?.column_default ?? 'column missing');
suite.check(
  'qstacks.stage is a real stored column, not derived/generated',
  stageCol?.is_generated === 'NEVER',
  stageCol?.is_generated ?? 'column missing',
);

await scenario('a freshly inserted qstack defaults stage to an empty string', async () => {
  const r = await pool.query(
    `insert into qstacks (org_id, owner_id, title) values ($1, $2, $3) returning stage`,
    [alpha.orgId, alpha.userId, `Stage default probe ${run}`],
  );
  if (r.rows[0].stage !== '') {
    throw new Error(`stage defaulted to ${JSON.stringify(r.rows[0].stage)}, expected ''`);
  }
});

// =========================================================================
// Criterion 2: public.qdecks
// =========================================================================

console.log('Criterion 2: public.qdecks');

const qdeckCols = (
  await pool.query(
    `select column_name, data_type, is_nullable
     from information_schema.columns
     where table_schema = 'public' and table_name = 'qdecks'`,
  )
).rows as { column_name: string; data_type: string; is_nullable: string }[];
const qc = new Map(qdeckCols.map((r) => [r.column_name, r]));

suite.check('qdecks table exists', qdeckCols.length > 0, `found ${qdeckCols.length} columns in information_schema`);
suite.check('qdecks.id is uuid', qc.get('id')?.data_type === 'uuid', JSON.stringify(qc.get('id')) ?? 'column missing');
suite.check(
  'qdecks.org_id is uuid, not null',
  qc.get('org_id')?.data_type === 'uuid' && qc.get('org_id')?.is_nullable === 'NO',
  JSON.stringify(qc.get('org_id')) ?? 'column missing',
);
suite.check(
  'qdecks.owner_id is uuid, not null',
  qc.get('owner_id')?.data_type === 'uuid' && qc.get('owner_id')?.is_nullable === 'NO',
  JSON.stringify(qc.get('owner_id')) ?? 'column missing',
);
suite.check(
  'qdecks.title is text, not null',
  qc.get('title')?.data_type === 'text' && qc.get('title')?.is_nullable === 'NO',
  JSON.stringify(qc.get('title')) ?? 'column missing',
);
suite.check(
  'qdecks.created_at is timestamptz, not null',
  qc.get('created_at')?.data_type === 'timestamp with time zone' && qc.get('created_at')?.is_nullable === 'NO',
  JSON.stringify(qc.get('created_at')) ?? 'column missing',
);

const qdeckPk = (
  await pool.query(
    `select kcu.column_name
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu
       on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
     where tc.table_schema = 'public' and tc.table_name = 'qdecks' and tc.constraint_type = 'PRIMARY KEY'`,
  )
).rows.map((r) => r.column_name as string);
suite.check('qdecks.id is the primary key', qdeckPk.length === 1 && qdeckPk[0] === 'id', JSON.stringify(qdeckPk));

const qdeckRls = (
  await pool.query(`select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'qdecks'`)
).rows[0] as { rowsecurity: boolean } | undefined;
suite.check('qdecks has row level security enabled', qdeckRls?.rowsecurity === true, JSON.stringify(qdeckRls) ?? 'table missing');

await scenario('org member can select a deck in their own org', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck sel ${run}`);
  const n = await countAsUser(alpha.userId, 'qdecks', 'id', deckId);
  if (n !== 1) throw new Error(`org member saw ${n} rows, expected 1`);
});

await scenario('a user in a different org cannot select a deck', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck xread ${run}`);
  const n = await countAsUser(beta.userId, 'qdecks', 'id', deckId);
  if (n !== 0) throw new Error(`beta saw ${n} rows of alpha's deck`);
});

// RLS blocks a cross-org UPDATE by FILTERING it out via the USING
// clause, not by throwing: the statement reports success with
// rowCount 0 and touches nothing. An exception is only raised for an
// INSERT (or an UPDATE's WITH CHECK) on a row the caller CAN see. So
// this asserts rowCount 0 plus unchanged content on a privileged
// read-back, not expectReject's "must throw."
await scenario('a user in a different org cannot modify a deck', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck xwrite ${run}`);
  const rowCount = await asUser(pool, beta.userId, async (c) => {
    const r = await c.query(`update qdecks set title = 'beta intrusion' where id = $1`, [deckId]);
    return r.rowCount;
  }, { commit: true });
  if (rowCount !== 0) {
    throw new Error(`beta update of alpha deck: expected the RLS USING clause to filter this to 0 rows, but rowCount was ${rowCount}`);
  }
  const after = await pool.query('select title from qdecks where id = $1', [deckId]);
  if (after.rows[0].title === 'beta intrusion') throw new Error('beta update landed');
});

await scenario('insert requires the inserting user to be the owner_id', async () => {
  await expectReject(
    () => asUser(pool, alpha.userId, async (c) => {
      await c.query(`insert into qdecks (org_id, owner_id, title) values ($1, $2, $3)`, [alpha.orgId, beta.userId, 'mismatched owner']);
    }, { commit: true }),
    'alpha inserting a deck owned by beta',
  );
});

await scenario('insert requires the inserting user to be a member of the deck org', async () => {
  await expectReject(
    () => asUser(pool, alpha.userId, async (c) => {
      await c.query(`insert into qdecks (org_id, owner_id, title) values ($1, $2, $3)`, [beta.orgId, alpha.userId, 'non-member insert']);
    }, { commit: true }),
    'alpha inserting into beta org',
  );
});

await scenario('a legitimate insert by an org-member owner succeeds', async () => {
  const deckId = await asUser(pool, alpha.userId, async (c) => {
    const r = await c.query(`insert into qdecks (org_id, owner_id, title) values ($1, $2, $3) returning id`, [alpha.orgId, alpha.userId, `Alpha Deck legit ${run}`]);
    return r.rows[0].id as string;
  }, { commit: true });
  const check = await pool.query('select id from qdecks where id = $1', [deckId]);
  if (check.rows.length !== 1) throw new Error('deck not found after a legitimate insert');
});

await scenario('anon cannot select any qdecks', async () => {
  const n = await asAnon(async (c) => {
    const r = await c.query('select count(*)::int as n from qdecks');
    return r.rows[0].n as number;
  });
  if (n !== 0) throw new Error(`anon saw ${n} rows`);
});

await scenario('anon cannot insert a qdeck', async () => {
  await expectReject(
    () => asAnon(async (c) => {
      await c.query(`insert into qdecks (org_id, owner_id, title) values ($1, $2, $3)`, [alpha.orgId, alpha.userId, 'anon intrusion deck']);
    }),
    'anon insert deck',
  );
});

// =========================================================================
// Criterion 3: qstacks.deck_id
// =========================================================================

console.log('Criterion 3: qstacks.deck_id');

const deckIdCol = (
  await pool.query(
    `select data_type, is_nullable
     from information_schema.columns
     where table_schema = 'public' and table_name = 'qstacks' and column_name = 'deck_id'`,
  )
).rows[0] as { data_type: string; is_nullable: string } | undefined;
suite.check('qstacks.deck_id column exists', !!deckIdCol, deckIdCol ? undefined : 'no matching information_schema.columns row');
suite.check('qstacks.deck_id is uuid', deckIdCol?.data_type === 'uuid', deckIdCol?.data_type ?? 'column missing');
suite.check('qstacks.deck_id is nullable', deckIdCol?.is_nullable === 'YES', deckIdCol?.is_nullable ?? 'column missing');

await scenario('3a: assigning a stack to a deck in a different org is rejected, even by the table owner', async () => {
  const betaDeckId = await createDeckAsAdmin(beta.orgId, beta.userId, `Beta Deck xorg ${run}`);
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack xorg ${run}`);
  await expectReject(
    () => pool.query('update qstacks set deck_id = $1 where id = $2', [betaDeckId, stackId]),
    'admin/table-owner cross-org deck assignment',
  );
  const after = await pool.query('select deck_id from qstacks where id = $1', [stackId]);
  if (after.rows[0].deck_id !== null) throw new Error('cross-org deck_id was set despite the expected rejection');
});

await scenario('3b: deleting a deck loosens its member stacks (deck_id -> null) without deleting them', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck delcascade ${run}`);
  const stackRes = await pool.query(
    `insert into qstacks (org_id, owner_id, title, deck_id) values ($1, $2, $3, $4) returning id`,
    [alpha.orgId, alpha.userId, `Alpha Stack delcascade ${run}`, deckId],
  );
  const stackId = stackRes.rows[0].id as string;
  await pool.query('delete from qdecks where id = $1', [deckId]);
  const after = await pool.query('select id, deck_id from qstacks where id = $1', [stackId]);
  if (after.rows.length !== 1) throw new Error('stack was deleted along with its deck; expected it to survive, loosened');
  if (after.rows[0].deck_id !== null) throw new Error(`deck_id was not nulled on deck delete: ${after.rows[0].deck_id}`);
});

await scenario('3c: removing a stack from its deck (deck_id -> null) succeeds and the stack survives', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck removal ${run}`);
  const stackRes = await pool.query(
    `insert into qstacks (org_id, owner_id, title, deck_id) values ($1, $2, $3, $4) returning id`,
    [alpha.orgId, alpha.userId, `Alpha Stack removal ${run}`, deckId],
  );
  const stackId = stackRes.rows[0].id as string;
  await pool.query('update qstacks set deck_id = null where id = $1', [stackId]);
  const after = await pool.query('select id, deck_id from qstacks where id = $1', [stackId]);
  if (after.rows.length !== 1) throw new Error('stack is missing after being removed from its deck');
  if (after.rows[0].deck_id !== null) throw new Error('deck_id is still set after being cleared');
});

// =========================================================================
// Criterion 4: public.canvas_positions
// =========================================================================

console.log('Criterion 4: public.canvas_positions');

const cpCols = (
  await pool.query(
    `select column_name, data_type, is_nullable
     from information_schema.columns
     where table_schema = 'public' and table_name = 'canvas_positions'`,
  )
).rows as { column_name: string; data_type: string; is_nullable: string }[];
const cpc = new Map(cpCols.map((r) => [r.column_name, r]));

suite.check('canvas_positions table exists', cpCols.length > 0, `found ${cpCols.length} columns in information_schema`);
suite.check('canvas_positions.id is uuid', cpc.get('id')?.data_type === 'uuid', JSON.stringify(cpc.get('id')) ?? 'column missing');
suite.check(
  'canvas_positions.qstack_id is uuid, nullable',
  cpc.get('qstack_id')?.data_type === 'uuid' && cpc.get('qstack_id')?.is_nullable === 'YES',
  JSON.stringify(cpc.get('qstack_id')) ?? 'column missing',
);
suite.check(
  'canvas_positions.deck_id is uuid, nullable',
  cpc.get('deck_id')?.data_type === 'uuid' && cpc.get('deck_id')?.is_nullable === 'YES',
  JSON.stringify(cpc.get('deck_id')) ?? 'column missing',
);
suite.check(
  'canvas_positions.x is double precision, not null',
  cpc.get('x')?.data_type === 'double precision' && cpc.get('x')?.is_nullable === 'NO',
  JSON.stringify(cpc.get('x')) ?? 'column missing',
);
suite.check(
  'canvas_positions.y is double precision, not null',
  cpc.get('y')?.data_type === 'double precision' && cpc.get('y')?.is_nullable === 'NO',
  JSON.stringify(cpc.get('y')) ?? 'column missing',
);
suite.check(
  'canvas_positions.created_at is timestamptz, not null',
  cpc.get('created_at')?.data_type === 'timestamp with time zone' && cpc.get('created_at')?.is_nullable === 'NO',
  JSON.stringify(cpc.get('created_at')) ?? 'column missing',
);

const cpPk = (
  await pool.query(
    `select kcu.column_name
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu
       on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
     where tc.table_schema = 'public' and tc.table_name = 'canvas_positions' and tc.constraint_type = 'PRIMARY KEY'`,
  )
).rows.map((r) => r.column_name as string);
suite.check('canvas_positions.id is the primary key', cpPk.length === 1 && cpPk[0] === 'id', JSON.stringify(cpPk));

const cpRls = (
  await pool.query(`select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'canvas_positions'`)
).rows[0] as { rowsecurity: boolean } | undefined;
suite.check('canvas_positions has row level security enabled', cpRls?.rowsecurity === true, JSON.stringify(cpRls) ?? 'table missing');

// --- 4a: XOR subject. ----------------------------------------------------

await scenario('4a: a position with both qstack_id and deck_id set is rejected', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck xor ${run}`);
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack xor ${run}`);
  await expectReject(
    () => pool.query('insert into canvas_positions (qstack_id, deck_id, x, y) values ($1, $2, 10, 20)', [stackId, deckId]),
    'both subjects set',
  );
});

await scenario('4a: a position with neither qstack_id nor deck_id set is rejected', async () => {
  await expectReject(
    () => pool.query('insert into canvas_positions (qstack_id, deck_id, x, y) values (null, null, 10, 20)', []),
    'neither subject set',
  );
});

await scenario('4a: a position with exactly one subject set succeeds', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack xorok ${run}`);
  const r = await pool.query('insert into canvas_positions (qstack_id, x, y) values ($1, 5, 6) returning id', [stackId]);
  if (r.rows.length !== 1) throw new Error('single-subject insert did not return a row');
});

// --- 4b: uniqueness. -------------------------------------------------------

await scenario('4b: a second position for the same qstack is rejected', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack uniq-q ${run}`);
  await pool.query('insert into canvas_positions (qstack_id, x, y) values ($1, 1, 1)', [stackId]);
  await expectReject(
    () => pool.query('insert into canvas_positions (qstack_id, x, y) values ($1, 2, 2)', [stackId]),
    'second position for the same qstack',
  );
});

await scenario('4b: a second position for the same deck is rejected', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck uniq ${run}`);
  await pool.query('insert into canvas_positions (deck_id, x, y) values ($1, 1, 1)', [deckId]);
  await expectReject(
    () => pool.query('insert into canvas_positions (deck_id, x, y) values ($1, 2, 2)', [deckId]),
    'second position for the same deck',
  );
});

// --- 4c: cascade on subject delete. ---------------------------------------

await scenario('4c: deleting the qstack deletes its position row', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack casc-q ${run}`);
  const posId = (await pool.query('insert into canvas_positions (qstack_id, x, y) values ($1, 1, 1) returning id', [stackId])).rows[0].id as string;
  await pool.query('delete from qstacks where id = $1', [stackId]);
  const after = await pool.query('select id from canvas_positions where id = $1', [posId]);
  if (after.rows.length !== 0) throw new Error('position row survived the qstack delete');
});

await scenario('4c: deleting the deck deletes its position row', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck casc ${run}`);
  const posId = (await pool.query('insert into canvas_positions (deck_id, x, y) values ($1, 1, 1) returning id', [deckId])).rows[0].id as string;
  await pool.query('delete from qdecks where id = $1', [deckId]);
  const after = await pool.query('select id from canvas_positions where id = $1', [posId]);
  if (after.rows.length !== 0) throw new Error('position row survived the deck delete');
});

// --- 4d: dormant position survives deck membership changes. ---------------

await scenario('4d: deck membership never deletes or alters a canvas position', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck dormant ${run}`);
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack dormant ${run}`);
  await pool.query('insert into canvas_positions (qstack_id, x, y) values ($1, 42, 84)', [stackId]);

  await pool.query('update qstacks set deck_id = $1 where id = $2', [deckId, stackId]);
  let pos = await pool.query('select x, y from canvas_positions where qstack_id = $1', [stackId]);
  if (pos.rows.length !== 1 || Number(pos.rows[0].x) !== 42 || Number(pos.rows[0].y) !== 84) {
    throw new Error(`position changed or vanished after deck assignment: ${JSON.stringify(pos.rows)}`);
  }

  await pool.query('update qstacks set deck_id = null where id = $1', [stackId]);
  pos = await pool.query('select x, y from canvas_positions where qstack_id = $1', [stackId]);
  if (pos.rows.length !== 1 || Number(pos.rows[0].x) !== 42 || Number(pos.rows[0].y) !== 84) {
    throw new Error(`position changed or vanished after deck removal: ${JSON.stringify(pos.rows)}`);
  }
});

// --- 4e: RLS. ---------------------------------------------------------------

await scenario('4e: an org member can select their own qstack canvas position', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack rls-sel ${run}`);
  const posId = (await pool.query('insert into canvas_positions (qstack_id, x, y) values ($1, 1, 1) returning id', [stackId])).rows[0].id as string;
  const n = await countAsUser(alpha.userId, 'canvas_positions', 'id', posId);
  if (n !== 1) throw new Error(`org member saw ${n} rows, expected 1`);
});

await scenario('4e: an org member can insert a canvas position for their own qstack', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack rls-ins ${run}`);
  const posId = await asUser(pool, alpha.userId, async (c) => {
    const r = await c.query('insert into canvas_positions (qstack_id, x, y) values ($1, 7, 8) returning id', [stackId]);
    return r.rows[0].id as string;
  }, { commit: true });
  const check = await pool.query('select id from canvas_positions where id = $1', [posId]);
  if (check.rows.length !== 1) throw new Error('org-member insert did not land');
});

await scenario('4e: an org member can update and delete their own qstack canvas position', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack rls-upd ${run}`);
  const posId = (await pool.query('insert into canvas_positions (qstack_id, x, y) values ($1, 1, 1) returning id', [stackId])).rows[0].id as string;
  await asUser(pool, alpha.userId, async (c) => {
    await c.query('update canvas_positions set x = 99 where id = $1', [posId]);
  }, { commit: true });
  const afterUpdate = await pool.query('select x from canvas_positions where id = $1', [posId]);
  if (Number(afterUpdate.rows[0].x) !== 99) throw new Error('org-member update did not land');

  await asUser(pool, alpha.userId, async (c) => {
    await c.query('delete from canvas_positions where id = $1', [posId]);
  }, { commit: true });
  const afterDelete = await pool.query('select id from canvas_positions where id = $1', [posId]);
  if (afterDelete.rows.length !== 0) throw new Error('org-member delete did not land');
});

await scenario('4e: a user in a different org cannot select a canvas position', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack rls-xsel ${run}`);
  const posId = (await pool.query('insert into canvas_positions (qstack_id, x, y) values ($1, 1, 1) returning id', [stackId])).rows[0].id as string;
  const n = await countAsUser(beta.userId, 'canvas_positions', 'id', posId);
  if (n !== 0) throw new Error(`beta saw ${n} rows`);
});

await scenario('4e: a user in a different org cannot insert a canvas position for a stack outside their org', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack rls-xins ${run}`);
  await expectReject(
    () => asUser(pool, beta.userId, async (c) => {
      await c.query('insert into canvas_positions (qstack_id, x, y) values ($1, 2, 2)', [stackId]);
    }, { commit: true }),
    'beta insert position for alpha stack',
  );
  const check = await pool.query('select id from canvas_positions where qstack_id = $1', [stackId]);
  if (check.rows.length !== 0) throw new Error('beta insert landed despite the expected rejection');
});

// Same RLS filter-vs-throw distinction as the qdecks cross-org update
// above: canvas_positions_all is a single FOR ALL policy, so a
// cross-org UPDATE or DELETE is filtered to 0 rows by USING, not
// rejected with an exception. Assert rowCount 0 plus unchanged content
// on a privileged read-back for each operation.
await scenario('4e: a user in a different org cannot update or delete a canvas position', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack rls-xupd ${run}`);
  const posId = (await pool.query('insert into canvas_positions (qstack_id, x, y) values ($1, 1, 1) returning id', [stackId])).rows[0].id as string;

  const updRowCount = await asUser(pool, beta.userId, async (c) => {
    const r = await c.query('update canvas_positions set x = 999 where id = $1', [posId]);
    return r.rowCount;
  }, { commit: true });
  if (updRowCount !== 0) {
    throw new Error(`beta update of alpha position: expected the RLS USING clause to filter this to 0 rows, but rowCount was ${updRowCount}`);
  }
  const afterUpd = await pool.query('select x from canvas_positions where id = $1', [posId]);
  if (Number(afterUpd.rows[0].x) !== 1) throw new Error('beta update changed the position content');

  const delRowCount = await asUser(pool, beta.userId, async (c) => {
    const r = await c.query('delete from canvas_positions where id = $1', [posId]);
    return r.rowCount;
  }, { commit: true });
  if (delRowCount !== 0) {
    throw new Error(`beta delete of alpha position: expected the RLS USING clause to filter this to 0 rows, but rowCount was ${delRowCount}`);
  }
  const afterDel = await pool.query('select id from canvas_positions where id = $1', [posId]);
  if (afterDel.rows.length === 0) throw new Error('beta delete landed');
});

await scenario("4e: a public-visibility qstack does not grant a non-member read of its canvas position", async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack rls-pubread ${run}`, { visibility: 'public' });
  const posId = (await pool.query('insert into canvas_positions (qstack_id, x, y) values ($1, 1, 1) returning id', [stackId])).rows[0].id as string;
  const n = await countAsUser(beta.userId, 'canvas_positions', 'id', posId);
  if (n !== 0) throw new Error(`beta (non-member) saw ${n} rows of a public stack's position`);
});

await scenario("4e: a public-visibility qstack does not grant a non-member write of its canvas position", async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack rls-pubwrite ${run}`, { visibility: 'public' });
  await expectReject(
    () => asUser(pool, beta.userId, async (c) => {
      await c.query('insert into canvas_positions (qstack_id, x, y) values ($1, 2, 2)', [stackId]);
    }, { commit: true }),
    'beta insert position for alpha public stack',
  );
  const check = await pool.query('select id from canvas_positions where qstack_id = $1', [stackId]);
  if (check.rows.length !== 0) throw new Error('beta write landed on a public stack position');
});

await scenario('4e: anon cannot select any canvas position', async () => {
  const n = await asAnon(async (c) => {
    const r = await c.query('select count(*)::int as n from canvas_positions');
    return r.rows[0].n as number;
  });
  if (n !== 0) throw new Error(`anon saw ${n} rows`);
});

await scenario('4e: anon cannot insert a canvas position', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack rls-anonins ${run}`);
  await expectReject(
    () => asAnon(async (c) => {
      await c.query('insert into canvas_positions (qstack_id, x, y) values ($1, 1, 1)', [stackId]);
    }),
    'anon insert position',
  );
});

// =========================================================================
// Criterion 5: REGRESSION GUARD -- public.stars scarcity (schema exists
// today; this is expected to PASS now and stay green after the
// migration lands).
// =========================================================================

console.log('Criterion 5 [REGRESSION GUARD, schema exists today]: public.stars scarcity');

await scenario('REGRESSION GUARD: duplicate (user_id, qstack_id) star insert is rejected', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack star ${run}`);
  await pool.query('insert into stars (user_id, qstack_id) values ($1, $2)', [alpha.userId, stackId]);
  await expectReject(
    () => pool.query('insert into stars (user_id, qstack_id) values ($1, $2)', [alpha.userId, stackId]),
    'duplicate star insert',
  );
});

// --- Cleanup: fixture rows only. Tolerate failures silently; never work
// around a trigger or constraint to force a delete through. -------------
try {
  await pool.query('delete from orgs where id = any($1::uuid[])', [[alpha.orgId, beta.orgId]]);
  await pool.query('delete from auth.users where id = any($1::uuid[])', [[alpha.userId, beta.userId]]);
} catch (err) {
  console.log(`cleanup: some schema-qdeck-canvas fixture rows could not be removed (${(err as Error).message.slice(0, 160)})`);
}

await recordEvalRun(pool, suite, null);
await pool.end();
process.exit(suite.passed ? 0 : 1);
