# Goal 2 Playwright E2E suite: handoff

Test Author only. No implementation code, no app routes, nothing
outside the four files below was written or modified.

## Files created

1. `playwright.config.ts`: loads `.env.local` (Node 24
   `process.loadEnvFile`), single worker, `expect.timeout` 10s,
   retries 0, reporter list, `baseURL` `http://localhost:3000`,
   `webServer` runs `npm run dev` with `reuseExistingServer: true`.
2. `tests/e2e/helpers/auth.ts`: the admin-link auth helper.
3. `tests/e2e/launch-of-friends.spec.ts`: the 10-step PRD Section 10
   success-criterion-1 flow, one test with `test.step` per step.
4. `tests/e2e/consent-ui.spec.ts`: the PRD 8.5 UI-path consent gate
   test, `test.describe.serial` with three `test.step`s.

## How to run

`npm run e2e` (equivalently `npx playwright test --reporter=list`).
Needs `.env.local` present with `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`. If nothing is
already listening on port 3000, Playwright starts `npm run dev`
itself; if something is, it reuses it.

## Harness bug found and fixed (in-scope, playwright.config.ts only)

Playwright's default `webServer.url` readiness check only treats
2xx, 3xx, and 400 to 403 responses as "ready." Every route in this
app currently 404s (only `app/layout.tsx` exists, no pages), so a
`url`-based check can never pass and always burns the full 120
second timeout, even though `next dev` itself is listening within
about 2 seconds. Switched `webServer` to `port: 3000` (waits for the
TCP port only, ignores HTTP status) instead of `url:
'http://localhost:3000'`. This is the one change I made after the
first verification run failed with `Error: Timed out waiting 120000ms
from config.webServer.`; confirmed the fix by rerunning from a clean
state (see below). `use.baseURL` still points at
`http://localhost:3000` for actual test navigation, unaffected.

Also observed, not caused by these files: while diagnosing the above
I manually started a second `npm run dev` by hand to compare against
Playwright's spawn, and the resulting collision (two processes
briefly racing for port 3000, plus my own repeated manual `curl`
requests against a server compiling `/` for the first time) corrupted
the `.next` build cache (`ENOENT ... app-paths-manifest.json` and
`_not-found/page.js`, surfacing as transient 500s). Killed the stray
process and deleted `.next` before the run recorded below. Not a bug
in these deliverables; noting it in case anyone else runs a manual
`npm run dev` alongside the Playwright-managed one during this build
window.

## Observed failure summary (proves valid missing-behavior failures)

Ran clean (`.next` deleted, nothing on port 3000, Playwright spawning
and owning its own server):

```
Running 2 tests using 1 worker
  ✘ tests\e2e\consent-ui.spec.ts:48:3 › consent gate is unbypassable in the DOM
  ✘ tests\e2e\launch-of-friends.spec.ts:31:1 › launch-of-friends: ... (3.0m)
  2 failed
```

1. `consent-ui.spec.ts`: `beforeAll` hook timed out at 60000ms
   waiting for `getByTestId('qstack-title-input')` after
   `page.goto('/qstacks/new')`. That route does not exist yet, so
   Next serves its default 404 and the testid never appears. This is
   the harness-soundness proof: the line immediately before the
   failure is `await signInAsTestUser(page, ...)`, and it completed
   with no exception, so the admin-mint-and-confirm mechanism
   (`SUPABASE_SECRET_KEY` reaching the worker process,
   `generateLink` succeeding, `/auth/confirm` navigation) ran
   correctly inside a real Playwright worker, not just my standalone
   verification script. The subsequent "Target page, context or
   browser has been closed" on the fill call is the hook-timeout
   cascading into the test body, not a separate cause.
2. `launch-of-friends.spec.ts`: step 1 timed out at its own
   180000ms override waiting for `getByTestId('signin-first-name')`
   after `page.goto('/signin')`. Same cause: the route does not exist
   yet. Test aborts at step 1 by design (`test.step` gives up on the
   first failure), so steps 2 through 10 never ran this time; they
   will once `/signin` exists.
3. `npx tsc --noEmit -p tsconfig.json` (the config covering
   `app/`, `src/`, `tests/`) is clean, zero errors. The compound
   `npm run type-check` script also runs `tsc -p
   tsconfig.scripts.json`, which reports 2 pre-existing errors in
   `scripts/hosted-diag.ts` and `src/lib/supabase/server.ts`, files
   this task never touched, from the concurrent Goal 2 build session
   active in this same repo. Not mine to fix; flagging only.

No config crash, no module-not-found, no env-missing error, and (in
the clean run) no webServer boot failure. Both failures are exactly
the 404-driven, testid-not-found kind the task expects at this point
in the build.

## Auth-helper mechanism

Verified empirically before writing the spec files (throwaway script,
run and deleted, printed only presence booleans and error messages,
never secret values): `supabase.auth.admin.generateLink({ type:
'magiclink', email, options: { data: { first_name } } })` alone, with
no prior `createUser` call, works identically on supabase-js v2.110
against this hosted project for:

1. A brand-new email address (auto-creates and confirms the user).
2. An address that already exists (e.g. one the real `/signin` form
   itself just created via `signInWithOtp`, or a repeat call for the
   same test user later in a flow).

So `signInAsTestUser(page, user, next)` in `tests/e2e/helpers/auth.ts`
just calls `generateLink` directly, no `createUser` step, then visits
`/auth/confirm?token_hash=<hash>&type=email&next=<next>`, mirroring
the surface contract's own stated mechanism exactly. `generateLink`'s
response includes `data.user.id`, cached in an in-memory
`email -> id` map so `deleteTestUser(email)` can call
`admin.deleteUser` at teardown without a separate `listUsers` lookup;
failures there are swallowed (append-only audit rows are deliberately
undeletable per decision D11, not a bug to route around).

User A's first step in `launch-of-friends.spec.ts` additionally fills
and submits the real `/signin` form and asserts `signin-sent`, per
the task's explicit carve-out, before the helper mints an equivalent
link for the same address. That spends one real, rate-limited
magic-link send from Supabase's mailer per run of this spec; worth
knowing if the suite gets run repeatedly in a short window.

## Contract ambiguities hit (flagged, not resolved by inventing testids)

Committed to one plausible interpretation per item, per the
surface contract's own testids and routes only. None of these
affected the verification run above (everything failed at step 1's
`/signin`, before any of this logic executes), so none are blocking;
they matter once real pages exist.

1. Where bank questions get added to a QStack: contract lists
   `bank-search-input` / `bank-search-submit` / `bank-result` /
   `bank-add-to-qstack` under a "Bank / retrieval" heading separate
   from "QStack view," suggesting the standalone `/bank` route.
   `/bank` has no documented mechanism for targeting which QStack an
   add applies to, and the task's own wording offers "via `/bank` or
   the QStack editor" as two options. Both specs use these testids
   directly on the QStack page (`/qstacks/new` after save, or
   `/qstacks/[id]`) without navigating to `/bank`, on the theory that
   they render inside an embedded panel there, consistent with the
   project's Locality-First doctrine. If the real implementation puts
   this only on a standalone `/bank` page, only these few lines need
   a `page.goto('/bank')` (and, if it exists, a targeting mechanism)
   inserted.
2. `bank-search-input` is left empty before clicking
   `bank-search-submit`, assuming an empty query returns a default,
   browsable result set. No seed-bank search term is guaranteed
   present from what I could verify, so I avoided guessing content.
3. `override-score` is assumed to reveal or reuse the same
   `score-anchor-1`..`4` controls for picking the new value (the spec
   clicks `override-score` then `score-anchor-2`). The contract names
   no separate control set for the override flow.
4. `interview-qstack` is assumed to be a native `<select>` whose
   option `value` equals the QStack's id (`selectOption({ value:
   clonedQStackId })`), not matched by label text, since a QStack and
   its clone could plausibly share the same visible title and make a
   label-based match ambiguous.
5. `start-session` is assumed reachable immediately after
   `interview-save`, without hard-coding whether that lands on
   `/interviews/[id]` or the `/interviews` list; the spec just waits
   for the testid rather than asserting an intermediate URL.
6. `share-link`'s URL is read via `.textContent()`, assuming it
   renders as visible display text next to `share-copy`, not as an
   `<input>` value.
7. `go-public-prompt` is asserted visible and its first `<button>`
   role is clicked (task instruction: "accepting the go-public
   prompt if shown"; since the contract itself says this prompt is
   "shown on first public QStack" and this genuinely is A's first,
   the spec asserts rather than conditionally checks).
8. No testid documents a link from a `market-card` to the creator's
   `/profiles/[handle]`, but step 10 explicitly requires reaching A's
   profile from the market card. The spec looks for `a[href^="/profiles/"]`
   scoped inside the matching `market-card` (a structural CSS
   locator, not an invented testid) and extracts the handle from its
   `href`.
9. Read "A publishes the original QStack public... before sharing"
   (task step 10) as "before B needs to find and star it," i.e. the
   publish happens right before step 10's marketplace actions, not
   literally before the brief share dialog in step 7. Publishing a
   QStack and sharing a brief are different objects; nothing else in
   the task implied restructuring steps 1 to 9.
10. `follow-button` is only asserted clickable (Playwright's default
    actionability check); the contract names no distinct "now
    following" state testid to assert against.
11. `brief-citation`, once clicked, is asserted to contain the
    response text within the same testid-tagged element
    (`toContainText` on the same locator post-click), assuming the
    expansion renders inside that element rather than a separate
    sibling.
12. `bank-result`'s accessible-name convention isn't specified in the
    contract (unlike `qstack-card` and `market-card`, both explicitly
    "accessible name = title"), so the two adds in step 2 are
    positional (`.nth(0)`, `.nth(1)`) rather than name-matched.

## Also flagged, not fixed (outside these deliverables)

`test-results/` (Playwright's own trace/artifact output) is untracked
and not yet in `.gitignore`. Left it as-is since `.gitignore` isn't
one of the four files in scope; worth adding `test-results/` and
`playwright-report/` there before this suite runs in CI.
