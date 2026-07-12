// TDD failing-test suite for D-ST-10 (buildlog/schema-track-build-log.md):
// migration 0011_function_grant_hygiene.sql revoked EXECUTE from `anon`
// on a set of security-definer functions, but never revoked EXECUTE
// from PUBLIC. Postgres grants EXECUTE to PUBLIC by default on function
// creation, and every database role (including `anon`) implicitly
// inherits PUBLIC's grants regardless of a role-specific revoke, so the
// `anon`-only revoke never closed the door. Migration 0018 (not written
// by this suite) is expected to explicitly `revoke execute ... from
// public` on these five functions.
//
// Follows the schema-qdeck-canvas.ts house pattern: standalone tsx
// script, Suite/check helpers, per-check console output, nonzero exit
// on failure, results persisted to eval_runs.
//
// Every check here is expected to FAIL right now: PUBLIC currently DOES
// have EXECUTE on all five functions (confirmed empirically against
// both the hosted database and this local embedded database, which ran
// the identical migrations 0001-0017, none of which ever revoked from
// PUBLIC).
import { adminPool } from '../../src/lib/db.js';
import { recordEvalRun, Suite } from '../lib/harness.js';

const pool = adminPool();
const suite = new Suite('schema_grant_hygiene');

// The five functions named in D-ST-10, with their exact argument type
// signatures as confirmed against the live database moments ago.
const targets: { name: string; argTypes: string[]; signature: string }[] = [
  { name: 'is_org_member', argTypes: ['uuid'], signature: 'is_org_member(uuid)' },
  { name: 'clone_qstack', argTypes: ['uuid', 'uuid'], signature: 'clone_qstack(uuid, uuid)' },
  { name: 'accept_share_invite', argTypes: ['text'], signature: 'accept_share_invite(text)' },
  { name: 'create_org', argTypes: ['text'], signature: 'create_org(text)' },
  { name: 'set_stack_deck', argTypes: ['uuid', 'uuid'], signature: 'set_stack_deck(uuid, uuid)' },
];

// pg_get_function_identity_arguments returns "paramname type[, paramname
// type...]" for these functions (they all use named parameters, e.g.
// "p_org uuid"). Extracting the last whitespace-separated token of each
// comma-separated segment gives the bare type name, which is what we
// compare against the expected signature. This avoids relying on
// parameter-name conventions (which could drift) while still being
// exact about argument count and type -- the precision the task asks
// for in case any of these five names are ever overloaded.
function parseArgTypes(identityArgs: string): string[] {
  if (identityArgs.trim() === '') return [];
  return identityArgs.split(',').map((segment) => {
    const parts = segment.trim().split(/\s+/);
    // parts is the result of splitting a (possibly empty) trimmed string on
    // whitespace, which always yields at least one element (['' ] in the
    // empty case), so the last index is always in range.
    return parts[parts.length - 1]!.toLowerCase();
  });
}

// Resolves the exact pg_proc oid for public.<name>(<argTypes>), matching
// on parsed identity-argument types rather than name alone, so an
// accidental future overload cannot silently match the wrong function.
async function resolveOid(name: string, argTypes: string[]): Promise<{ oid: number } | { error: string }> {
  const res = await pool.query(
    `select p.oid, pg_get_function_identity_arguments(p.oid) as identity_args
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = $1`,
    [name],
  );
  if (res.rows.length === 0) {
    return { error: `no function named public.${name} found in pg_proc` };
  }
  const matches = res.rows.filter((r) => {
    const parsed = parseArgTypes(r.identity_args as string);
    // The length check short-circuits before .every runs, so argTypes[i] is
    // guaranteed to exist for every index i the callback is invoked with.
    return parsed.length === argTypes.length && parsed.every((t, i) => t === argTypes[i]!.toLowerCase());
  });
  if (matches.length === 0) {
    const found = res.rows.map((r) => `(${r.identity_args})`).join(', ');
    return { error: `public.${name} exists but no overload matches (${argTypes.join(', ')}); found: ${found}` };
  }
  if (matches.length > 1) {
    return { error: `public.${name}(${argTypes.join(', ')}) is ambiguous: ${matches.length} matching oids` };
  }
  return { oid: matches[0].oid as number };
}

// Expands the function's ACL (pg_proc.proacl) into individual
// grantee/privilege rows via aclexplode, resolving grantee oid 0 to the
// literal name 'PUBLIC' (Postgres's convention for the PUBLIC
// pseudo-role in an ACL). Falls back to acldefault('f', proowner) for
// the (here, unused) case of a null proacl, i.e. a function that has
// never had its default privileges touched -- which still implies
// PUBLIC EXECUTE by default for an ordinary function.
async function executeGrantees(oid: number): Promise<{ grantee: string; privilege: string }[]> {
  const res = await pool.query(
    `select
       case when ae.grantee = 0 then 'PUBLIC' else coalesce(r.rolname, ae.grantee::text) end as grantee,
       ae.privilege_type as privilege
     from pg_proc p
     cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) as ae
     left join pg_roles r on r.oid = ae.grantee
     where p.oid = $1`,
    [oid],
  );
  return res.rows as { grantee: string; privilege: string }[];
}

for (const target of targets) {
  const name = `PUBLIC does not have EXECUTE on ${target.signature}`;
  const resolved = await resolveOid(target.name, target.argTypes);
  if ('error' in resolved) {
    suite.check(name, false, resolved.error);
    continue;
  }
  const grants = await executeGrantees(resolved.oid);
  const executeGrantsList = grants.filter((g) => g.privilege === 'EXECUTE').map((g) => g.grantee);
  const hasPublicExecute = executeGrantsList.includes('PUBLIC');
  suite.check(
    name,
    !hasPublicExecute,
    `EXECUTE currently granted to: [${executeGrantsList.join(', ')}]`,
  );
}

await recordEvalRun(pool, suite, null);
await pool.end();
process.exit(suite.passed ? 0 : 1);
