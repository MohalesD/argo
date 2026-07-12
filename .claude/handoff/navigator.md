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

---

# Deck-owned stars and set_stack_deck: Test Author handoff (second suite)

Failing-test suite for the not-yet-built schema work: deck-owned stars
(planned migration 0016) and the `set_stack_deck` definer function
(planned migration 0017). Written before either migration exists, per
the strict-TDD rule; do not modify this file or the test file to make it
pass -- implement the migrations instead. This suite is separate from
`schema-qdeck-canvas.ts` (untouched, still GREEN, re-verified during this
pass) and does not duplicate its checks.

## File created

`evals/suites/schema-deck-stars.ts` (one new file; no existing files
touched, `package.json` untouched, `schema-qdeck-canvas.ts` untouched).

## Run command

```
npx tsx evals/suites/schema-deck-stars.ts
```

Requires the local database up on `127.0.0.1:5799` with migrations 0001
through 0015 applied (confirmed running at write time). No seed data
required; all fixtures are built inline (two orgs, three named users --
alpha owner, beta owner, one plain `member`-role user in alpha's org --
plus 25 additional plain-member users created inline for the seal-
threshold check).

## Status: RED (expected)

Ran twice against the local database (migrations through 0015, no
deck-star or `set_stack_deck` schema present). Both runs: **37 checks
total, 32 FAIL / 5 PASS**, exit code 1, recorded to `eval_runs` under
suite name `schema_deck_stars`. Verified zero leftover fixture rows
(orgs, auth users including the 25 seal-check users) after a run.

### Why 5 PASS today, not 0

Two of the five are true regression guards (existing schema, expected to
stay green): duplicate-qstack-star rejection (existing `unique
(user_id, qstack_id)`) and the `qstacks.star_count` trigger path
(existing `maintain_star_count`). The other three are **structural
invariants that are already true today and are not expected to change**
when 0016/0017 land, so they are not "not-yet-built" checks at all, just
checked here because the acceptance criteria call them out explicitly:

1. `canvas_positions gains no star-related columns from this work` --
   true now (no star columns exist anywhere near this table) and should
   stay true forever; this is a guard against scope creep into 0015's
   table, not a forward-looking check.
2. `7: starring and unstarring a positioned stack leaves its
   canvas_positions row byte-identical` -- exercises only the existing
   qstack-star path (`stars.qstack_id`, which already works today), not
   the new deck-star path, so it is already true. The deck-star sibling
   check (`7: starring and unstarring a positioned deck ...`) DOES fail
   today, correctly, since `stars.deck_id` does not exist yet.
3. `13: a plain non-owner, non-admin member DIRECT UPDATE of
   qstacks.deck_id affects zero rows` -- `qstacks.deck_id` (0014) and the
   `qstacks_update` policy (0007) both predate this task; a plain
   member's direct UPDATE is already filtered by the existing `USING
   (owner_id = auth.uid() or is_org_admin(org_id))` clause. This check
   exists to make sure migration 0017 does not widen that policy while
   adding `set_stack_deck`; it should stay green through and after 0017.

Every other failing check's detail was one of these valid, expected
reasons:

1. `column "star_count" does not exist` / `column "deck_id" does not
   exist` on `qdecks` or `stars` -- Postgres code `42703`.
2. `qdecks column set is exactly {...}, no status (found [created_at,
   id, org_id, owner_id, title])` -- `star_count` missing from the
   actual set; this is `information_schema.columns`, which does not
   throw on a missing column, so the check fails cleanly on the array
   comparison instead of an exception. (No `status` column is present
   either, which is correct and will remain so; the failure here is
   purely the missing `star_count`.)
3. `null value in column "qstack_id" ... violates not-null constraint`
   -- Postgres code `23502`. This is the one non-obvious case: right
   now `stars.qstack_id` is still `NOT NULL` (pre-0016), so an insert
   with neither subject set fails on that stale constraint, not on the
   intended "exactly one of qstack_id/deck_id" `CHECK`, which does not
   exist yet. `expectReject`'s `SCHEMA_MISSING_CODES` set was extended
   with `23502` (beyond the sibling suite's `42P01`/`42703`) specifically
   to catch this -- without it, this check would have reported a false
   PASS for the wrong reason, the same failure mode the sibling suite's
   `expectReject` design note already warns about. See "Extended
   SCHEMA_MISSING_CODES" below for why this is safe.
4. `function set_stack_deck(unknown, unknown) does not exist` --
   Postgres code `42883` (undefined_function), also added to
   `SCHEMA_MISSING_CODES` for the same reason: without it, "beta cannot
   call `set_stack_deck` on alpha's stack," "cross-org deck assignment
   through the function is rejected," and "anon cannot execute
   `set_stack_deck`" would all report a false PASS today merely because
   the function does not exist, not because the authorization rule
   under test actually fired.
5. `no matching pg_proc row` / `no matching information_schema.columns
   row` / `function missing` / `column missing` -- detail strings for
   structural checks reading `pg_proc` or `information_schema.columns`
   directly, which return zero rows rather than throwing.

No check failed on a connection error, a typo, or a fixture bug.

## Check list summary (by acceptance criterion)

**Part A -- deck-owned stars (migration 0016):**

1. `qdecks.star_count` (4 checks, all FAIL): column existence, type
   `integer`, `NOT NULL`, default `0`.
2. `qdecks` locked column set, no `status` (1 check, FAIL): asserts the
   exact set `{id, org_id, owner_id, title, created_at, star_count}`.
3. `stars.qstack_id`/`deck_id`/XOR/cascade (7 checks): `qstack_id`
   nullable (FAIL), `deck_id` existence/type/nullability (3 FAIL), both-
   subjects-set rejected (FAIL, missing column), neither-subject-set
   rejected (FAIL, `23502` as above), deck delete cascades to delete its
   stars (FAIL, missing column; `ON DELETE CASCADE` is not yet
   independently verifiable until the column exists).
4. Star scarcity (4 checks): duplicate qstack star (**PASS**,
   REGRESSION), duplicate deck star (FAIL), same user stars both a stack
   and a deck (FAIL), two different users star the same deck (FAIL).
5. Cached counts (4 checks): qstack star_count trigger (**PASS**,
   REGRESSION), deck star_count increments (FAIL), deck star_count
   decrements never below 0 (FAIL), 25-user seal threshold `>= 25`
   (FAIL).
6. RLS on the deck-star path (5 checks, all FAIL): org member insert,
   mismatched `user_id` rejected, cross-org insert rejected, anon select
   blocked, anon insert blocked.
7. Spatial-memory isolation (3 checks): no star-related columns leak
   into `canvas_positions` (**PASS**, structural invariant), positioned-
   stack star/unstar leaves its position byte-identical (**PASS**,
   exercises only the pre-existing qstack-star path), positioned-deck
   star/unstar leaves its position byte-identical (FAIL, needs
   `stars.deck_id`).

**Part B -- `set_stack_deck` (migration 0017):**

8. Function existence, security definer (2 checks, both FAIL).
9. Plain-member assign and remove-via-null (2 checks, both FAIL).
10. Function touches only `deck_id`, full-row before/after comparison
    over every column returned by `select *` (1 check, FAIL).
11. Cross-org caller rejected (1 check, FAIL -- correctly not a false
    PASS; see `SCHEMA_MISSING_CODES` note above).
12. Cross-org deck target rejected (1 check, FAIL, same reason).
13. `qstacks_update` not widened, direct UPDATE, rowCount-based (1
    check, **PASS** -- already true today, see above).
14. anon cannot execute `set_stack_deck` (1 check, FAIL -- correctly not
    a false PASS, same reason as 11/12).

## Helpers added (local to the suite file; reused verbatim from the
sibling suite where unchanged)

1. `asAnon`, `scenario`, `createDeckAsAdmin`, `createStack`: identical in
   spirit to `schema-qdeck-canvas.ts`'s versions (see above); redefined
   locally rather than shared, matching that suite's own choice not to
   extract a shared module.
2. **Extended `SCHEMA_MISSING_CODES`**: `{'42P01', '42703', '42883',
   '23502'}`, two codes beyond the sibling suite's `{'42P01', '42703'}`.
   Verified neither addition creates a false negative in this suite: no
   check in `schema-deck-stars.ts` relies on `23502` (not-null violation)
   or `42883` (undefined function) as its *legitimate* expected-rejection
   reason after 0016/0017 land -- post-migration, the XOR check fires via
   a named `CHECK` constraint (`23514`) and the function-based
   authorization checks fire via `RAISE EXCEPTION` inside
   `set_stack_deck` or an RLS/grant rejection, neither of which is
   `42883`. Any future suite adding definer-function or NOT-NULL-relaxed-
   to-nullable coverage should extend `SCHEMA_MISSING_CODES` the same way
   and do the same "does any legitimate rejection in this suite share
   this code" check before adding it.
3. `addPlainMember(orgId, email, firstName)`: new helper, not in the
   sibling suite. Inserts an `auth.users` row plus an `org_members` row
   with `role = 'member'` directly via the admin pool (mirrors
   `createUserWithOrg`'s own posture of bypassing `org_members` RLS for
   fixture setup). Needed because `createUserWithOrg` always seeds the
   org's `owner`; acceptance criteria 9-13 specifically require a caller
   who is neither the stack owner nor an org admin. Reused 26 times: once
   for the fixture `alphaMember`, once per seal-check user (25).
4. `starAsUser`: thin helper wrapping a single-subject star insert as a
   given user; only used where the RLS path itself isn't under test
   (kept most checks using direct `asUser`/`pool.query` calls instead,
   matching the sibling suite's preference for explicit per-check SQL
   over hidden helper behavior).

## Notes

1. Cleanup deletes the two fixture orgs (cascades `org_members`,
   `qstacks`, `qdecks`, and, once built, deck-scoped `stars` rows via
   their `org_id`/`qstack_id`/`deck_id` foreign keys) then all fixture
   `auth.users` rows (`alpha`, `beta`, `alphaMember`, and all 25 seal-
   check users, tracked in a `sealUserIds` array), wrapped in try/catch,
   tolerated silently. Verified zero leftover fixture rows after two
   consecutive runs, including the 25-user loop.
2. The 25-user seal-check (criterion 5, "prototype seeds deck d2 at 29")
   fails today on the very first star insert inside the loop (missing
   `stars.deck_id`), so only 1 of the 25 planned users is actually
   created before the scenario throws -- intentional; `addPlainMember`
   and the star insert happen back-to-back inside the loop body, so no
   wasted fixture creation beyond the one iteration that ran before the
   failure. Confirmed via the leftover-row check above that this partial
   user is still cleaned up (it's tracked in `sealUserIds` immediately
   after creation, before the insert that throws).
3. `set_stack_deck`'s full-row-unchanged check (criterion 10) compares
   every column `select * from qstacks` returns, not just the acceptance
   criterion's named list (`title, visibility, stage, role_family,
   level, methodology, org_id, owner_id, star_count`) -- this also
   incidentally covers `forked_from_id` and `created_at`, which is
   stricter than the acceptance criterion required, not weaker.
4. Confirmed via `git status`/`git diff --stat` after the run that
   `schema-qdeck-canvas.ts` was not touched and still reports GREEN (39/
   39) when re-run.

## Expected-green criteria after migrations 0016 and 0017 land

Every currently-FAIL check above should flip to PASS with no test-file
changes. Two things to verify explicitly at that point, beyond a bare
green run:

1. The `23502`/`42883` entries in this suite's `SCHEMA_MISSING_CODES`
   should stop being exercised at all post-migration (every rejection
   should instead be a real `CHECK`/RLS/grant failure) -- if a check
   still passes only because of one of those two codes being swallowed,
   that is a sign the real constraint under test still is not wired up.
2. Re-run `schema-qdeck-canvas.ts` alongside this suite once both land,
   the same cross-suite regression posture used for this pass.
