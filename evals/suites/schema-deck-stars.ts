// TDD failing-test suite for deck-owned stars and the set_stack_deck
// definer function (not yet built as of this writing: migrations 0016
// and 0017). Follows the schema-qdeck-canvas.ts house pattern: standalone
// tsx script, per-check console output, nonzero exit on any failure,
// results persisted to eval_runs. Do not modify to make it pass --
// implement the migrations instead.
//
// Acceptance criteria under test:
//
// Part A (migration 0016): deck-owned stars.
//  1. qdecks gains star_count (integer, not null, default 0).
//  2. qdecks does NOT gain a status column: the column set is exactly
//     {id, org_id, owner_id, title, created_at, star_count}.
//  3. stars.qstack_id becomes nullable; new nullable deck_id references
//     qdecks on delete cascade; a CHECK requires exactly one of
//     qstack_id/deck_id.
//  4. Star scarcity per subject (qstack scarcity is a REGRESSION guard;
//     deck scarcity is new); same user can star both a stack and a deck;
//     two different users can star the same deck.
//  5. Cached counts: starring/unstarring a deck moves qdecks.star_count
//     (never below 0); qstacks.star_count path still works (REGRESSION);
//     25 distinct users starring one deck yields star_count >= 25.
//  6. RLS on the deck-star path: org member can insert; cross-org insert
//     rejected; anon cannot insert or select.
//  7. Spatial-memory isolation: starring/unstarring a positioned stack
//     and a positioned deck leaves canvas_positions rows byte-identical,
//     and canvas_positions gains no star-related columns.
//
// Part B (migration 0017): set_stack_deck(p_stack uuid, p_deck uuid).
//  8. Function exists, security definer.
//  9. A plain org member (not stack owner, not org admin) can assign a
//     loose stack to a deck in their org via the function, and remove it
//     again by passing p_deck null.
// 10. The function updates ONLY deck_id: every other qstacks column is
//     unchanged on a full-row before/after comparison.
// 11. A user from a different org cannot move the stack via the function.
// 12. Cross-org deck assignment through the function is impossible.
// 13. qstacks_update is not widened: a plain member's DIRECT UPDATE of
//     deck_id affects zero rows (RLS filter, not exception).
// 14. anon cannot execute set_stack_deck (grant hygiene, 0011 pattern).
//
// Every check for not-yet-built behavior is expected to FAIL right now
// with a missing-column / missing-constraint / undefined-function error.
// Checks marked REGRESSION are expected to PASS now and stay green.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { adminPool } from '../../src/lib/db.js';
import { asUser, createUserWithOrg, recordEvalRun, Suite } from '../lib/harness.js';

const pool = adminPool();
const suite = new Suite('schema_deck_stars');
const run = randomUUID().slice(0, 8);

// --- Local helpers, mirrored from schema-qdeck-canvas.ts ----------------

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

async function scenario(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    suite.check(name, true);
  } catch (err) {
    suite.check(name, false, (err as Error).message.slice(0, 140));
  }
}

// Postgres error codes for undefined_table / undefined_column /
// undefined_function / not_null_violation: the operation never reached
// the rule under test. not_null_violation (23502) is included because
// stars.qstack_id is NOT NULL today (pre-migration); an insert with
// neither subject set fails on that stale constraint right now, not on
// the intended "exactly one of qstack_id/deck_id" CHECK, which does not
// exist yet -- without re-throwing this code, that check would report a
// false PASS for the wrong reason (see 0011-era note on this same
// pitfall in the sibling suite).
const SCHEMA_MISSING_CODES = new Set(['42P01', '42703', '42883', '23502']);

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
    // under test (RLS policy, check constraint, unique, FK). Expected.
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

async function createStack(orgId: string, ownerId: string, title: string): Promise<string> {
  const r = await pool.query(
    `insert into qstacks (org_id, owner_id, title) values ($1, $2, $3) returning id`,
    [orgId, ownerId, title],
  );
  return r.rows[0].id as string;
}

// A plain org member: NOT owner, NOT admin. createUserWithOrg always
// seeds the org's owner, so this adds a second auth user and a
// 'member'-role row directly, bypassing org_members RLS via the admin
// pool (the same posture createUserWithOrg itself takes).
async function addPlainMember(orgId: string, email: string, firstName: string): Promise<string> {
  const user = await pool.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values (gen_random_uuid(), $1, jsonb_build_object('first_name', $2::text))
     returning id`,
    [email, firstName],
  );
  const userId: string = user.rows[0].id;
  await pool.query(
    `insert into org_members (org_id, user_id, role) values ($1, $2, 'member')`,
    [orgId, userId],
  );
  return userId;
}

async function starAsUser(userId: string, subject: { qstackId?: string; deckId?: string }): Promise<void> {
  if (subject.qstackId) {
    await asUser(pool, userId, async (c) => {
      await c.query('insert into stars (user_id, qstack_id) values ($1, $2)', [userId, subject.qstackId]);
    }, { commit: true });
  } else {
    await asUser(pool, userId, async (c) => {
      await c.query('insert into stars (user_id, deck_id) values ($1, $2)', [userId, subject.deckId]);
    }, { commit: true });
  }
}

// --- Fixtures: two orgs, existing schema only. ---------------------------

const alpha = await createUserWithOrg(pool, `alpha_${run}@deckstarprobe.test`, 'Alpha', `DeckStar Org Alpha ${run}`);
const beta = await createUserWithOrg(pool, `beta_${run}@deckstarprobe.test`, 'Beta', `DeckStar Org Beta ${run}`);
const alphaMember = await addPlainMember(alpha.orgId, `alphamember_${run}@deckstarprobe.test`, 'AlphaMember');

const sealUserIds: string[] = []; // 25-user seal-check fixtures, tracked for cleanup

// =========================================================================
// Part A: deck-owned stars
// =========================================================================

console.log('Part A, criterion 1: qdecks.star_count');

const qdeckStarCountCol = (
  await pool.query(
    `select data_type, is_nullable, column_default
     from information_schema.columns
     where table_schema = 'public' and table_name = 'qdecks' and column_name = 'star_count'`,
  )
).rows[0] as { data_type: string; is_nullable: string; column_default: string | null } | undefined;
suite.check('qdecks.star_count column exists', !!qdeckStarCountCol, qdeckStarCountCol ? undefined : 'no matching information_schema.columns row');
suite.check('qdecks.star_count is integer', qdeckStarCountCol?.data_type === 'integer', qdeckStarCountCol?.data_type ?? 'column missing');
suite.check('qdecks.star_count is NOT NULL', qdeckStarCountCol?.is_nullable === 'NO', qdeckStarCountCol?.is_nullable ?? 'column missing');
suite.check('qdecks.star_count defaults to 0', qdeckStarCountCol?.column_default === '0', qdeckStarCountCol?.column_default ?? 'column missing');

console.log('Part A, criterion 2: qdecks column set is locked (no status field)');

const qdeckAllCols = (
  await pool.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'qdecks'`,
  )
).rows.map((r) => r.column_name as string).sort();
const expectedQdeckCols = ['created_at', 'id', 'org_id', 'owner_id', 'star_count', 'title'].sort();
suite.check(
  'qdecks column set is exactly {id, org_id, owner_id, title, created_at, star_count}, no status',
  JSON.stringify(qdeckAllCols) === JSON.stringify(expectedQdeckCols),
  `found [${qdeckAllCols.join(', ')}]`,
);

console.log('Part A, criterion 3: stars.qstack_id nullable, stars.deck_id, XOR check');

const starsQstackCol = (
  await pool.query(
    `select is_nullable from information_schema.columns
     where table_schema = 'public' and table_name = 'stars' and column_name = 'qstack_id'`,
  )
).rows[0] as { is_nullable: string } | undefined;
suite.check('stars.qstack_id is nullable', starsQstackCol?.is_nullable === 'YES', starsQstackCol?.is_nullable ?? 'column missing');

const starsDeckCol = (
  await pool.query(
    `select data_type, is_nullable from information_schema.columns
     where table_schema = 'public' and table_name = 'stars' and column_name = 'deck_id'`,
  )
).rows[0] as { data_type: string; is_nullable: string } | undefined;
suite.check('stars.deck_id column exists', !!starsDeckCol, starsDeckCol ? undefined : 'no matching information_schema.columns row');
suite.check('stars.deck_id is uuid', starsDeckCol?.data_type === 'uuid', starsDeckCol?.data_type ?? 'column missing');
suite.check('stars.deck_id is nullable', starsDeckCol?.is_nullable === 'YES', starsDeckCol?.is_nullable ?? 'column missing');

await scenario('3: a star with both qstack_id and deck_id set is rejected', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack star-xor ${run}`);
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck star-xor ${run}`);
  await expectReject(
    () => pool.query('insert into stars (user_id, qstack_id, deck_id) values ($1, $2, $3)', [alpha.userId, stackId, deckId]),
    'both subjects set on a star',
  );
});

await scenario('3: a star with neither qstack_id nor deck_id set is rejected', async () => {
  await expectReject(
    () => pool.query('insert into stars (user_id) values ($1)', [alpha.userId]),
    'neither subject set on a star',
  );
});

await scenario('3: deleting a deck cascades to delete its stars (ON DELETE CASCADE)', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck star-cascade ${run}`);
  const starId = (await pool.query('insert into stars (user_id, deck_id) values ($1, $2) returning id', [alpha.userId, deckId])).rows[0].id as string;
  await pool.query('delete from qdecks where id = $1', [deckId]);
  const after = await pool.query('select id from stars where id = $1', [starId]);
  if (after.rows.length !== 0) throw new Error('star row survived the deck delete; expected ON DELETE CASCADE on stars.deck_id');
});

console.log('Part A, criterion 4: star scarcity per subject');

await scenario('REGRESSION: a second star by the same user on the same qstack is rejected', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack scarcity-q ${run}`);
  await pool.query('insert into stars (user_id, qstack_id) values ($1, $2)', [alpha.userId, stackId]);
  await expectReject(
    () => pool.query('insert into stars (user_id, qstack_id) values ($1, $2)', [alpha.userId, stackId]),
    'duplicate qstack star',
  );
});

await scenario('4: a second star by the same user on the same deck is rejected', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck scarcity-d ${run}`);
  await pool.query('insert into stars (user_id, deck_id) values ($1, $2)', [alpha.userId, deckId]);
  await expectReject(
    () => pool.query('insert into stars (user_id, deck_id) values ($1, $2)', [alpha.userId, deckId]),
    'duplicate deck star',
  );
});

await scenario('4: the same user can star both a stack and a deck', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack both ${run}`);
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck both ${run}`);
  await pool.query('insert into stars (user_id, qstack_id) values ($1, $2)', [alpha.userId, stackId]);
  await pool.query('insert into stars (user_id, deck_id) values ($1, $2)', [alpha.userId, deckId]);
  const n = (await pool.query('select count(*)::int as n from stars where user_id = $1 and (qstack_id = $2 or deck_id = $3)', [alpha.userId, stackId, deckId])).rows[0].n;
  if (n !== 2) throw new Error(`expected 2 stars for the same user across stack+deck, got ${n}`);
});

await scenario('4: two different users can star the same deck', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck twousers ${run}`);
  await pool.query('insert into stars (user_id, deck_id) values ($1, $2)', [alpha.userId, deckId]);
  await pool.query('insert into stars (user_id, deck_id) values ($1, $2)', [alphaMember, deckId]);
  const n = (await pool.query('select count(*)::int as n from stars where deck_id = $1', [deckId])).rows[0].n;
  if (n !== 2) throw new Error(`expected 2 stars on the deck, got ${n}`);
});

console.log('Part A, criterion 5: cached star_count maintenance');

await scenario('REGRESSION: starring a qstack still increments qstacks.star_count', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack count-q ${run}`);
  await pool.query('insert into stars (user_id, qstack_id) values ($1, $2)', [alpha.userId, stackId]);
  const after = await pool.query('select star_count from qstacks where id = $1', [stackId]);
  if (after.rows[0].star_count !== 1) throw new Error(`qstacks.star_count is ${after.rows[0].star_count}, expected 1`);
});

await scenario('5: starring a deck increments qdecks.star_count by 1', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck count-inc ${run}`);
  await pool.query('insert into stars (user_id, deck_id) values ($1, $2)', [alpha.userId, deckId]);
  const after = await pool.query('select star_count from qdecks where id = $1', [deckId]);
  if (after.rows[0].star_count !== 1) throw new Error(`qdecks.star_count is ${after.rows[0].star_count}, expected 1`);
});

await scenario('5: unstarring a deck decrements qdecks.star_count, never below 0', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck count-dec ${run}`);
  const starId = (await pool.query('insert into stars (user_id, deck_id) values ($1, $2) returning id', [alpha.userId, deckId])).rows[0].id as string;
  await pool.query('delete from stars where id = $1', [starId]);
  const after = await pool.query('select star_count from qdecks where id = $1', [deckId]);
  if (after.rows[0].star_count !== 0) throw new Error(`qdecks.star_count is ${after.rows[0].star_count}, expected 0`);
});

await scenario('5: seal threshold data check -- 25 distinct users starring one deck yields star_count >= 25', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck seal ${run}`);
  for (let i = 0; i < 25; i++) {
    const uid = await addPlainMember(alpha.orgId, `sealuser${i}_${run}@deckstarprobe.test`, `Seal${i}`);
    sealUserIds.push(uid);
    await pool.query('insert into stars (user_id, deck_id) values ($1, $2)', [uid, deckId]);
  }
  const after = await pool.query('select star_count from qdecks where id = $1', [deckId]);
  if (after.rows[0].star_count < 25) throw new Error(`qdecks.star_count is ${after.rows[0].star_count}, expected >= 25`);
});

console.log('Part A, criterion 6: RLS on the deck-star path');

await scenario('6: an org member can insert a star on a deck visible to them', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck rls-ins ${run}`);
  const starId = await asUser(pool, alpha.userId, async (c) => {
    const r = await c.query('insert into stars (user_id, deck_id) values ($1, $2) returning id', [alpha.userId, deckId]);
    return r.rows[0].id as string;
  }, { commit: true });
  const check = await pool.query('select id from stars where id = $1', [starId]);
  if (check.rows.length !== 1) throw new Error('org-member deck star did not land');
});

await scenario('6: a user cannot insert a star on a deck with a mismatched user_id', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck rls-mismatch ${run}`);
  await expectReject(
    () => asUser(pool, alpha.userId, async (c) => {
      await c.query('insert into stars (user_id, deck_id) values ($1, $2)', [beta.userId, deckId]);
    }, { commit: true }),
    'alpha inserting a star as beta',
  );
});

await scenario('6: a user from a different org cannot star that deck', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck rls-xorg ${run}`);
  await expectReject(
    () => asUser(pool, beta.userId, async (c) => {
      await c.query('insert into stars (user_id, deck_id) values ($1, $2)', [beta.userId, deckId]);
    }, { commit: true }),
    'beta starring an alpha deck',
  );
  const check = await pool.query('select id from stars where deck_id = $1 and user_id = $2', [deckId, beta.userId]);
  if (check.rows.length !== 0) throw new Error('cross-org star landed despite the expected rejection');
});

await scenario('6: anon cannot select any deck stars', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck rls-anonsel ${run}`);
  await pool.query('insert into stars (user_id, deck_id) values ($1, $2)', [alpha.userId, deckId]);
  const n = await asAnon(async (c) => {
    const r = await c.query('select count(*)::int as n from stars where deck_id = $1', [deckId]);
    return r.rows[0].n as number;
  });
  if (n !== 0) throw new Error(`anon saw ${n} deck-star rows`);
});

await scenario('6: anon cannot insert a deck star', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck rls-anonins ${run}`);
  await expectReject(
    () => asAnon(async (c) => {
      await c.query('insert into stars (user_id, deck_id) values ($1, $2)', [alpha.userId, deckId]);
    }),
    'anon insert deck star',
  );
});

console.log('Part A, criterion 7: spatial-memory isolation from deck stars');

const cpAllCols = (
  await pool.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'canvas_positions'`,
  )
).rows.map((r) => r.column_name as string);
suite.check(
  'canvas_positions gains no star-related columns from this work',
  !cpAllCols.some((c) => c.toLowerCase().includes('star')),
  `found [${cpAllCols.join(', ')}]`,
);

await scenario('7: starring and unstarring a positioned stack leaves its canvas_positions row byte-identical', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack spatial-q ${run}`);
  const posId = (await pool.query('insert into canvas_positions (qstack_id, x, y) values ($1, 111, 222) returning id', [stackId])).rows[0].id as string;
  const before = (await pool.query('select id, qstack_id, deck_id, x, y from canvas_positions where id = $1', [posId])).rows[0];

  const starId = (await pool.query('insert into stars (user_id, qstack_id) values ($1, $2) returning id', [alpha.userId, stackId])).rows[0].id as string;
  let after = (await pool.query('select id, qstack_id, deck_id, x, y from canvas_positions where id = $1', [posId])).rows[0];
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`position changed after starring: ${JSON.stringify(after)}`);

  await pool.query('delete from stars where id = $1', [starId]);
  after = (await pool.query('select id, qstack_id, deck_id, x, y from canvas_positions where id = $1', [posId])).rows[0];
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`position changed after unstarring: ${JSON.stringify(after)}`);
});

await scenario('7: starring and unstarring a positioned deck leaves its canvas_positions row byte-identical', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck spatial-d ${run}`);
  const posId = (await pool.query('insert into canvas_positions (deck_id, x, y) values ($1, 333, 444) returning id', [deckId])).rows[0].id as string;
  const before = (await pool.query('select id, qstack_id, deck_id, x, y from canvas_positions where id = $1', [posId])).rows[0];

  const starId = (await pool.query('insert into stars (user_id, deck_id) values ($1, $2) returning id', [alpha.userId, deckId])).rows[0].id as string;
  let after = (await pool.query('select id, qstack_id, deck_id, x, y from canvas_positions where id = $1', [posId])).rows[0];
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`position changed after starring: ${JSON.stringify(after)}`);

  await pool.query('delete from stars where id = $1', [starId]);
  after = (await pool.query('select id, qstack_id, deck_id, x, y from canvas_positions where id = $1', [posId])).rows[0];
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error(`position changed after unstarring: ${JSON.stringify(after)}`);
});

// =========================================================================
// Part B: set_stack_deck(p_stack uuid, p_deck uuid)
// =========================================================================

console.log('Part B, criterion 8: set_stack_deck exists, security definer');

const setStackDeckFn = (
  await pool.query(
    `select p.prosecdef, pg_get_function_identity_arguments(p.oid) as args
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'set_stack_deck'`,
  )
).rows[0] as { prosecdef: boolean; args: string } | undefined;
suite.check('set_stack_deck function exists', !!setStackDeckFn, setStackDeckFn ? undefined : 'no matching pg_proc row');
suite.check('set_stack_deck is security definer', setStackDeckFn?.prosecdef === true, setStackDeckFn ? JSON.stringify(setStackDeckFn) : 'function missing');

console.log('Part B, criteria 9-10: a plain org member can assign/remove via the function; only deck_id changes');

await scenario('9: a plain org member (not owner, not admin) can assign a loose stack to a deck in their org', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack fn-assign ${run}`);
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck fn-assign ${run}`);
  await asUser(pool, alphaMember, async (c) => {
    await c.query('select set_stack_deck($1, $2)', [stackId, deckId]);
  }, { commit: true });
  const after = await pool.query('select deck_id from qstacks where id = $1', [stackId]);
  if (after.rows[0].deck_id !== deckId) throw new Error(`deck_id is ${after.rows[0].deck_id}, expected ${deckId}`);
});

await scenario('9: the same plain org member can remove the stack from its deck by passing null', async () => {
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck fn-remove ${run}`);
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack fn-remove ${run}`);
  await asUser(pool, alphaMember, async (c) => {
    await c.query('select set_stack_deck($1, $2)', [stackId, deckId]);
  }, { commit: true });
  await asUser(pool, alphaMember, async (c) => {
    await c.query('select set_stack_deck($1, $2)', [stackId, null]);
  }, { commit: true });
  const after = await pool.query('select id, deck_id from qstacks where id = $1', [stackId]);
  if (after.rows.length !== 1) throw new Error('stack is missing after being removed from its deck via the function');
  if (after.rows[0].deck_id !== null) throw new Error('deck_id is still set after being cleared via the function');
});

await scenario('10: the function updates only deck_id -- every other qstacks column is unchanged', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack fn-onlydeck ${run}`);
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck fn-onlydeck ${run}`);
  const before = (await pool.query('select * from qstacks where id = $1', [stackId])).rows[0] as Record<string, unknown>;
  await asUser(pool, alphaMember, async (c) => {
    await c.query('select set_stack_deck($1, $2)', [stackId, deckId]);
  }, { commit: true });
  const after = (await pool.query('select * from qstacks where id = $1', [stackId])).rows[0] as Record<string, unknown>;
  for (const key of Object.keys(before)) {
    if (key === 'deck_id') continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      throw new Error(`column ${key} changed: ${JSON.stringify(before[key])} -> ${JSON.stringify(after[key])}`);
    }
  }
  if (after.deck_id !== deckId) throw new Error(`deck_id did not update: ${JSON.stringify(after.deck_id)}`);
});

console.log('Part B, criteria 11-12: cross-org rejections through the function');

await scenario('11: a user from a different org cannot move the stack via the function', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack fn-xorguser ${run}`);
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck fn-xorguser ${run}`);
  await expectReject(
    () => asUser(pool, beta.userId, async (c) => {
      await c.query('select set_stack_deck($1, $2)', [stackId, deckId]);
    }, { commit: true }),
    'beta moving an alpha stack via set_stack_deck',
  );
  const after = await pool.query('select deck_id from qstacks where id = $1', [stackId]);
  if (after.rows[0].deck_id !== null) throw new Error('cross-org function call set deck_id despite the expected rejection');
});

await scenario('12: assigning a stack to a deck in a different org through the function is rejected', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack fn-xorgdeck ${run}`);
  const betaDeckId = await createDeckAsAdmin(beta.orgId, beta.userId, `Beta Deck fn-xorgdeck ${run}`);
  await expectReject(
    () => asUser(pool, alphaMember, async (c) => {
      await c.query('select set_stack_deck($1, $2)', [stackId, betaDeckId]);
    }, { commit: true }),
    'alpha member assigning an alpha stack to a beta deck via set_stack_deck',
  );
  const after = await pool.query('select deck_id from qstacks where id = $1', [stackId]);
  if (after.rows[0].deck_id !== null) throw new Error('cross-org deck assignment landed despite the expected rejection');
});

console.log('Part B, criterion 13: qstacks_update is not widened (direct UPDATE, RLS filter not exception)');

await scenario('13: a plain non-owner, non-admin member DIRECT UPDATE of qstacks.deck_id affects zero rows', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack directupd ${run}`);
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck directupd ${run}`);
  const rowCount = await asUser(pool, alphaMember, async (c) => {
    const r = await c.query('update qstacks set deck_id = $1 where id = $2', [deckId, stackId]);
    return r.rowCount;
  }, { commit: true });
  if (rowCount !== 0) {
    throw new Error(`plain member direct UPDATE of qstacks.deck_id: expected the RLS USING clause to filter this to 0 rows, but rowCount was ${rowCount}`);
  }
  const after = await pool.query('select deck_id from qstacks where id = $1', [stackId]);
  if (after.rows[0].deck_id !== null) throw new Error('direct UPDATE landed despite the expected RLS filter');
});

console.log('Part B, criterion 14: anon cannot execute set_stack_deck');

await scenario('14: anon cannot execute set_stack_deck', async () => {
  const stackId = await createStack(alpha.orgId, alpha.userId, `Alpha Stack fn-anon ${run}`);
  const deckId = await createDeckAsAdmin(alpha.orgId, alpha.userId, `Alpha Deck fn-anon ${run}`);
  await expectReject(
    () => asAnon(async (c) => {
      await c.query('select set_stack_deck($1, $2)', [stackId, deckId]);
    }),
    'anon calling set_stack_deck',
  );
});

// --- Cleanup: fixture rows only. Tolerate failures silently; never work
// around a trigger or constraint to force a delete through. -------------
try {
  await pool.query('delete from orgs where id = any($1::uuid[])', [[alpha.orgId, beta.orgId]]);
  await pool.query('delete from auth.users where id = any($1::uuid[])', [[alpha.userId, beta.userId, alphaMember, ...sealUserIds]]);
} catch (err) {
  console.log(`cleanup: some schema-deck-stars fixture rows could not be removed (${(err as Error).message.slice(0, 160)})`);
}

await recordEvalRun(pool, suite, null);
await pool.end();
process.exit(suite.passed ? 0 : 1);
