# QDeck / canvas-position schema: Test Author handoff

Failing-test suite for the not-yet-built schema work: qstacks.stage,
public.qdecks, qstacks.deck_id, and public.canvas_positions. Written
before any migration, per the strict-TDD rule; do not modify this file
or the test file to make it pass -- implement the migration instead.

## File created

`evals/suites/schema-qdeck-canvas.ts` (one new file; no existing files
touched, `package.json` untouched).

## Run command

```
npx tsx evals/suites/schema-qdeck-canvas.ts
```

Requires the local database up (`npm run db:fresh`, currently applies
migrations 0001 through 0012). No seed data required; all fixtures are
built inline (two orgs, two users, via `createUserWithOrg`).

## Status: GREEN

Migrations 0001 through 0015 are applied to the local embedded database
(127.0.0.1:5799), including 0014 (`qdecks`) and 0015
(`canvas_positions`), so this suite now exercises the built schema
rather than a missing one.

Latest run: 39 of 39 checks PASS, exit code 0, recorded to `eval_runs`
under suite name `schema_qdeck_canvas`. Verified no leftover fixture
rows (orgs, auth users) remain after the run.

Between the pre-migration RED baseline recorded below and this GREEN
run, a second Test Author pass found and fixed two checks that were
asserting the wrong failure mode for RLS-blocked cross-org UPDATE/DELETE
(see "Fixed: RLS filter-vs-throw" under Notes). No implementation code,
migration, or schema was touched to reach GREEN; only those two checks
in this file changed.

### Historical: original RED baseline (pre-migration)

Ran twice against a fresh local database (127.0.0.1:5799, schema
through migration 0012, no qdeck/canvas-position schema present).
39 checks total, 38 FAIL / 1 PASS both times, exit code 1. Verified no
leftover fixture rows (orgs, auth users) remained after either run.

Every failing check's detail was one of these valid, expected reasons:

1. `relation "qdecks" does not exist` -- Postgres code 42P01.
2. `relation "canvas_positions" does not exist` -- Postgres code 42P01.
3. `column "stage" does not exist` -- Postgres code 42703.
4. `column missing` / `no matching information_schema.columns row` /
   `found 0 columns in information_schema` / `table missing` / `[]` --
   my own detail strings for structural checks that read
   `information_schema.columns`, `information_schema.table_constraints`,
   or `pg_tables` directly (these never throw on a missing
   table/column; they return zero rows, so the check fails cleanly on
   the boolean comparison instead of an exception).

No check failed on a connection error, a typo, or a fixture bug.

## Check list summary (by acceptance criterion)

1. **qstacks.stage** (6 checks, all FAIL): column existence, type text,
   NOT NULL, default `''`, `is_generated = 'NEVER'` (real stored column,
   not derived), and a live-insert check that a fresh row's `stage`
   comes back `''`.
2. **public.qdecks** (16 checks, all FAIL): table existence, column
   shapes (`id` uuid pk, `org_id`/`owner_id` uuid not null, `title` text
   not null, `created_at` timestamptz not null), RLS enabled, org-member
   select, cross-org select/update blocked, insert-ownership and
   insert-membership rules, a legitimate insert, anon select/insert
   blocked.
3. **qstacks.deck_id** (6 checks, all FAIL): column existence/type/
   nullability, 3a (cross-org assignment rejected even for the table
   owner/service-role, simulated via the raw admin pool which connects
   as Postgres user `postgres`, the table owner in the embedded
   cluster), 3b (deck delete loosens member stacks, does not delete
   them), 3c (deck_id -> null succeeds, stack survives).
4. **public.canvas_positions** (26 checks, all FAIL): table existence,
   column shapes (`id` uuid pk, `qstack_id`/`deck_id` uuid nullable,
   `x`/`y` double precision not null, `created_at` timestamptz not
   null), RLS enabled, XOR subject (both set / neither set / exactly
   one set), uniqueness per qstack and per deck, cascade on qstack
   delete and on deck delete, dormant-position survival across deck
   assignment and removal (4d), and the full RLS matrix (org-member
   select/insert/update/delete, cross-org select/insert/update/delete
   blocked, public-visibility qstack does NOT grant a non-member
   read or write of its position, anon select/insert blocked).
5. **REGRESSION GUARD: public.stars scarcity** (1 check, PASS): the
   existing `unique (user_id, qstack_id)` constraint on `public.stars`
   (migration 0005) already rejects a duplicate star. This table exists
   today; the check is labeled `REGRESSION GUARD` in its check name and
   is expected to stay green after the migration lands.

## Helpers added (local to the suite file)

1. `asAnon(fn)`: SET LOCAL ROLE anon inside a rolled-back transaction,
   mirroring `anon-browse.ts`'s local helper (not exported from the
   shared harness).
2. `countAsUser(userId, table, idColumn, idValue)`: thin wrapper over
   `asUser` from `evals/lib/harness.ts` for row-visibility counts.
3. `scenario(name, fn)`: runs a whole check (fixture setup + action +
   post-condition assertion) as one unit; any throw anywhere in `fn`,
   including a missing-table error during setup, fails the check with
   that error as the detail. This is what makes 38 of 39 checks
   correctly report FAIL right now instead of being silently skipped.
4. `expectReject(action, label)`: requires `action()` to throw. Notable
   design point, found and fixed during this task: a naive version of
   this helper (swallow any exception as "the constraint worked")
   produced 5 FALSE-POSITIVE PASSes on the first run --
   "insert requires the inserting user to be the owner_id",
   "insert requires the inserting user to be a member of the deck org",
   "anon cannot insert a qdeck", "a position with neither qstack_id nor
   deck_id set is rejected", and "anon cannot insert a canvas position"
   -- because the INSERT failed with `relation does not exist` before
   the actual rule under test (ownership, RLS, XOR check) ever ran, and
   that failure was being credited as if the rule had fired. Fixed by
   checking the Postgres error `code`: `42P01` (undefined_table) and
   `42703` (undefined_column) are re-thrown instead of swallowed, so
   those checks now correctly FAIL with the real reason. Any future
   suite using an "expect the database to reject this" pattern should
   reuse this distinction rather than a bare try/catch.
5. `createDeckAsAdmin(orgId, ownerId, title)` and
   `createStack(orgId, ownerId, title, { visibility? })`: fixture
   builders reused across checks; each check builds its own fixture row
   rather than sharing one across checks, so failures stay isolated.

## Notes

1. Cross-org rejection in 3a is tested via the raw `adminPool` (no
   `asUser` wrapper), which connects as `postgres`, the embedded
   cluster's table owner/superuser -- this is the closest local
   equivalent to "service role/table owner" per the acceptance
   criterion, and matches the existing house pattern in
   `evals/suites/consent.ts` check 3 ("privileged service path").
2. `information_schema.columns.data_type` for `timestamptz` reads back
   as `'timestamp with time zone'` and a `''` default reads back as
   `"''::text"` in this Postgres build; confirmed empirically against
   `orgs.created_at` / `qstacks.role_family` before writing the
   assertions, to avoid a string-format typo masquerading as a real
   failure.
3. Cleanup deletes the two fixture orgs (cascades qstacks and, once
   built, qdecks/canvas_positions via their org_id/qstack_id/deck_id
   foreign keys) then the two fixture auth users, wrapped in try/catch,
   tolerated silently. Verified zero leftover fixture rows after two
   consecutive runs.
4. `node_modules` did not exist at the start of this task; ran
   `npm install` once (155 packages) before `npm run db:fresh` would
   work. No `package.json`/`package-lock.json` edits were made beyond
   what `npm install` itself resolves against the existing lockfile.
5. **Fixed: RLS filter-vs-throw (second Test Author pass, post-
   migration).** Against the built schema, two checks reported FAIL
   with detail `... expected the database to reject this, but it
   succeeded`: "a user in a different org cannot modify a deck" and
   "4e: a user in a different org cannot update or delete a canvas
   position." Both used `expectReject`, which requires a thrown error.
   Confirmed by reading `qdecks_update` (0007/0014) and
   `canvas_positions_all` (0015) plus an empirical probe (`asUser` as
   the cross-org user, read back `rowCount`) that this was a test bug,
   not a schema leak: Postgres row-level security blocks `UPDATE` and
   `DELETE` on rows the `USING` clause hides by **filtering them out**,
   not by raising an exception -- the statement reports success with
   `rowCount: 0` and no row changes. An exception is only raised for an
   `INSERT` (or an `UPDATE`'s `WITH CHECK`) on a row the caller CAN see
   but the check rejects. The two checks were rewritten to assert
   `rowCount === 0` for the cross-org `UPDATE`/`DELETE` plus unchanged
   content on a privileged (admin pool) read-back, instead of requiring
   a throw. Any future suite that asserts "a cross-org user cannot
   modify/delete this row" via RLS should use the rowCount-plus-
   readback pattern, not `expectReject` -- `expectReject` stays correct
   for `INSERT` and for `WITH CHECK` failures on visible rows, both of
   which do throw.
