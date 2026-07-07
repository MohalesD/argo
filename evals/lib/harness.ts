import pg from 'pg';

export interface Check {
  name: string;
  passed: boolean;
  detail?: string;
}

// Collects named pass/fail checks for one suite run.
export class Suite {
  readonly checks: Check[] = [];
  constructor(readonly name: string) {}

  check(name: string, passed: boolean, detail?: string): void {
    this.checks.push({ name, passed, detail });
    const mark = passed ? 'PASS' : 'FAIL';
    console.log(`  [${mark}] ${name}${detail ? ` (${detail})` : ''}`);
  }

  get passed(): boolean {
    return this.checks.length > 0 && this.checks.every((c) => c.passed);
  }
}

// Persists a suite result to eval_runs (PRD Section 8: results persist).
export async function recordEvalRun(
  pool: pg.Pool,
  suite: Suite,
  model: string | null,
  extraMetrics: Record<string, unknown> = {},
): Promise<void> {
  const metrics = {
    checks: suite.checks,
    total: suite.checks.length,
    failed: suite.checks.filter((c) => !c.passed).length,
    ...extraMetrics,
  };
  await pool.query(
    'insert into eval_runs (suite, model, passed, metrics) values ($1, $2, $3, $4)',
    [suite.name, model, suite.passed, JSON.stringify(metrics)],
  );
  console.log(
    `${suite.passed ? 'GREEN' : 'RED'}: suite ${suite.name} recorded to eval_runs`,
  );
}

// Runs fn as an authenticated user under RLS: SET LOCAL ROLE plus JWT
// claims inside one transaction, exactly how PostgREST executes queries.
export async function asUser<T>(
  pool: pg.Pool,
  userId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
  opts: { commit?: boolean } = {},
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    const result = await fn(client);
    await client.query(opts.commit ? 'commit' : 'rollback');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Test fixture: an auth user (via shim auth.users, mirrored into
// public.users by the signup trigger) plus an org they own.
export async function createUserWithOrg(
  pool: pg.Pool,
  email: string,
  firstName: string,
  orgName: string,
): Promise<{ userId: string; orgId: string }> {
  const user = await pool.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, jsonb_build_object('first_name', $2::text))
     returning id`,
    [email, firstName],
  );
  const userId: string = user.rows[0].id;
  const org = await pool.query('insert into orgs (name) values ($1) returning id', [orgName]);
  const orgId: string = org.rows[0].id;
  await pool.query(
    "insert into org_members (org_id, user_id, role) values ($1, $2, 'owner')",
    [orgId, userId],
  );
  return { userId, orgId };
}
