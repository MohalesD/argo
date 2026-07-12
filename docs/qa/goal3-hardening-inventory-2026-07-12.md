# Goal 3 Hardening Inventory
**2026-07-12 · Compiled by Claude Sonnet 5 on the harden-track worktree**

Docs-only compilation, exempt from the Quiz Before Merging gate per
CLAUDE.md. All quoted items below are verbatim from the source files
named, not summarized or reworded. Each item is tagged exactly one of:
`fixable-by-code`, `requires-Mo`, `requires-Mo-judgment`,
`monitoring-threshold-only` (reserved for exactly one item, the
statistical adverse-impact monitoring trigger).

## 1. Could-not-verify items, goal2-build-log.md

Source: `buildlog/goal2-build-log.md`, "Could not verify" section.

1. **A real emailed magic-link click.** GoTrue accepted real sends from
   the /signin form (signin-sent reached when under the mailer cap) and
   the confirm route verified admin-minted token hashes end to end
   dozens of times, but no machine-readable inbox exists to click an
   actual delivered email. The PKCE code branch of /auth/confirm is
   written but unexercised. First human sign-in verifies both; if it
   fails, look there first.
   **Tag: requires-Mo**

2. **Concurrent starring at real concurrency.** The unique constraint
   plus count trigger make over-counting structurally impossible, and
   the e2e proves the single-user path; a truly concurrent multi-client
   race was not driven this window (Goal 3 hardening candidate).
   **Tag: fixable-by-code**

3. **PDF visual parity.** The PDF renders the same content structure
   from the same data (one renderer, no divergent copy) and the route
   returns a valid document, but pixel-level review of the export
   against the web brief is a human pass, queued for Goal 3.
   **Tag: requires-Mo**

4. **Retrieval relevance ground truth.** Suite 8.1's 25 relevance sets
   are model-judged (Test Author), standing in for the PRD's
   human-judged sets. Flagged for Mo's spot check by role family.
   **Tag: requires-Mo**

5. **Keyboard and touch parity.** dnd-kit keyboard sensors and
   accessible names are wired throughout, but the PRD's keyboard-only
   full-interview pass is Goal 3 scope and was not driven here.
   **Tag: fixable-by-code**

## 2. Watched items carried to Goal 3, goal2-build-log.md

Source: `buildlog/goal2-build-log.md`, "Watched items carried to Goal 3"
section.

1. Mailer: the built-in send cap makes real signups fragile in bursts;
   custom SMTP (or at minimum the token-hash email template) before
   launch-of-friends invites go out.

   Split into two items, not treated as one action:

   1a. Wiring Supabase's custom SMTP config and the token-hash email
       template once real credentials exist in `.env.local`.
       **Tag: fixable-by-code**

   1b. Obtaining the SMTP provider account and real credentials in the
       first place. Per D-G2-2 and the I-G2-1 ruling already in this
       repo's own build log, credentials are never agent-set or
       agent-obtained, blocked or not. This is the same category of
       action, not a new one.
       **Tag: requires-Mo**

2. The eval 8.3 suite judge runs at default temperature (test file,
   Test Author's domain); if it ever flakes, temperature 0 there is the
   first lever.
   **Tag: fixable-by-code**

3. Suite fixture residue accumulates on hosted (users, orgs, ended
   sessions; questions born flagged). Harmless and invisible, but a
   periodic cleanup of the deletable subset would keep the dashboard
   readable.
   **Tag: fixable-by-code**

4. marketplace premium listings render (price badge, Coming soon) but
   no owner UI creates listings yet; decide in Goal 3 whether listing
   creation ships or the interface stays seed-only.
   **Tag: requires-Mo-judgment**

5. Statistical adverse-impact monitoring trigger unchanged: revisit at
   500 real scored responses (PRD 3.2.3).
   **Tag: monitoring-threshold-only**

## 3. Entries in watch-items.md

Source: `docs/architecture/watch-items.md`, full file, both entries.
Note: neither entry is in scope for this hardening track unless the
work directly touches sharing contracts (entry 1) or QStack UI
(entry 2).

### Shared-record type contract only exists for briefs

**Date:** 2026-07-10
**Status:** WATCH
**Source:** Graphify trace of the 243 weakly-connected nodes (ResponseInfo, ShareRow, InterviewRow)

Argo's architecture doctrine (this CLAUDE.md, PRD) commits to a shared-record
model from day one: interviewer, hiring manager, and team all touch the same
records. Right now that commitment is only realized in code for briefs:
src/lib/brief.ts defines BriefContent/BriefClaim once, reused by BriefRow and
ClaimView(). Interviews, shares, and responses have no equivalent: each page
(interviews/page.tsx, briefs/[id]/page.tsx, share/[token]/page.tsx) declares
its own private inline row type with no shared definition.

Specific asymmetry worth checking before extending sharing/interviews: ShareRow
(owner view, in the brief page) and the SharedBrief type (token view, in
share/[token]/page.tsx) describe the same sharing surface from opposite ends
and may not agree on shape, not yet verified.

**Before building out interview or response sharing further: decide whether
these need a shared typed contract like brief.ts, or whether staying
page-local is intentional for now.**

**Tag: requires-Mo-judgment** — not in scope for this track unless the work
directly touches sharing contracts.

### QStackRow does not yet read stage or deck_id

**Date:** 2026-07-12
**Status:** WATCH
**Source:** Schema/backend track (migrations 0013-0017, hosted-verified)

QStackRow in components/QStackCard.tsx does not yet read stage or deck_id,
both now live on hosted as of migration 0013-0017. The visual track that
would normally consume this closed before schema landed. Whoever picks up
QStack UI work next needs to wire these two fields before Canvas or the
deck page can render real stage pills or deck membership from live data.

**Tag: fixable-by-code** — not in scope for this track unless the work
directly touches QStack UI.

## 4. Step-9 flakiness item

Source reference: `tasks/todo.md`, Theme 2 ("Hardening, carried from the
original Goal 3 scope"), names this item verbatim as:

> the could-not-verify items from both build logs, the step-9 flakiness
> watch item, marketplace owner listing creation UI decision

The underlying incident, per `.claude/handoff/navigator-e2e.md` (verbatim):

> reserved .test TLD with 400 email_address_invalid (verified live);
> the admin generateLink path accepted it fine, which is exactly why
> consent-ui (admin-only auth) passed while the real /signin form
> submission in launch-of-friends step 1 failed. One change point,
> since every test email flows through `testEmail()`; this also
> covers step 9's share signup form for user B.

### Diagnostic logging confirmation

Read in full: `tests/e2e/helpers/auth.ts`, function `signInAsTestUser`
(lines 60-97). The diagnostic logging referenced for the step-9
`generateLink` flake is present and intact, verbatim:

```ts
  if (error || !data?.properties?.hashed_token) {
    const fullErrorDump = error
      ? JSON.stringify(error, Object.getOwnPropertyNames(error))
      : 'null';
    console.error('[signInAsTestUser] generateLink raw error:', fullErrorDump);
    console.error('[signInAsTestUser] generateLink error.status:', (error as any)?.status);
    console.error('[signInAsTestUser] generateLink error.code:', (error as any)?.code);
    console.error('[signInAsTestUser] generateLink error.name:', (error as any)?.name);
    console.error('[signInAsTestUser] generateLink data:', JSON.stringify(data));
    throw new Error(
      `generateLink failed for ${user.email}: ${error?.message ?? 'no hashed_token returned'} | raw: ${fullErrorDump}`,
    );
  }
```

Also confirmed present in the same file: the redirect-verification checks
immediately following (lines 85-96) that throw a descriptive error if
`auth/confirm` lands on `/signin` or on the wrong expected path, rather
than silently passing.

**Confirmed: diagnostic logging is present and intact.**

**Tag: fixable-by-code** — the diagnostics are in place to catch a
recurrence; no outstanding code change is needed unless the flake
reappears.
