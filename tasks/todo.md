# Argo July 10-12 Evolution Push: Plan

**July 10, 2026. Goal 2 plan archived at `tasks/goal2-todo-archive.md`.**
**Status: SCAFFOLD, awaiting Mo's direction. Fable 5 leading.**

## What this push is

A large, time-boxed evolution push with Fable 5 leading, running through
the extended access window (Fable 5 available through July 12, 2026).
The job is to map Mo's vision into Argo across several plan-mode sessions
and `/goal` pushes and passes, rather than execute a single pre-written
spec. Goals 1 and 2 (schema, then surfaces) are complete; this push is
about evolving what exists toward the product Mo actually wants, not
ticking off a fixed acceptance list.

## How this file gets filled in

1. Mo and Fable run plan-mode sessions to surface the vision, one theme
   at a time.
2. Each theme that survives planning becomes a `/goal` push with its own
   acceptance criteria, written here before code.
3. Each push follows the standing agentic-engineering guardrails
   (`docs/architecture/agentic-engineering-v0_1-2026-07-10.md`): strict
   TDD via Test-Author subagent, HTML mockups before UI decisions,
   Playwright as a stop condition, model and effort routing per step.
4. Mo reviews this file between passes and redirects.

## Themes

1. QStack visual and interaction identity. Cards on a canvas, Kanban as the
   default view, a genuine collectibles feel to the library instead of a
   plain list. Mode: Plan Mode first, not /goal, this is a judgment call on
   feel. HTML prototypes reviewed before any wiring. Reuses the existing
   KanbanBoard() and dnd-kit drag mechanic, does not rebuild it. Status:
   COMPLETE. Ran as five prototype passes, not one: three competing
   directions, then Pass A (the card), Pass A2 (a Sonnet fix pass), Pass B
   (decks and canvas), Pass C (the QDeck page and real canvas), and Pass
   C2 (canvas geometry). Direction 02, The Fleece Ledger, was chosen by
   independent three-way consensus. Approved prototype:
   `prototypes/qstack-library/06-fleece-ledger-deckpage.html`.
   Implementation now moves to the parallel schema and backend track.
2. Hardening, carried from the original Goal 3 scope. Keyboard and touch
   parity on the interview surface, empty and error states to the microcopy
   standard, PDF visual check, custom SMTP before real invites, the
   could-not-verify items from both build logs, the step-9 flakiness watch
   item, marketplace owner listing creation UI decision. Mode: mostly
   /goal-ready.
3. Not yet written. Only fill this in if Theme 1's output surfaces a real
   third direction.

Parking lot (not an active theme): ShareRow/SharedBrief type asymmetry
from docs/architecture/watch-items.md. Only becomes a theme if a future
theme touches sharing or interview record contracts directly.

## Backlog

Agreed, not yet built, not yet scheduled as a theme.

1. Responsive rail count on the Board view. Board currently assumes four
   stage rails. Once pipelines are customizable by department and by
   position, stage count becomes user-defined and unbounded, so a board
   hardcoded around four rails breaks on the first eight-stage
   engineering loop. This is a consequence of stage being real data, not
   a polish item. The board must respond to a variable rail count, not
   just to screen width.
2. Attribution and marketplace lineage: "forked from," "created by,"
   clickable through to a seller's marketplace profile.
3. Question-level navigation: a More affordance opening the full question
   list, and clicking a question to jump straight into edit mode for it.
4. Ram logo redesign. The current mark reads as a bee, not a ram.
5. Boat motif as faded narrative background art on landing and marketing
   surfaces.
6. A user-facing motion intensity setting.
7. The full PLG (product-led growth) sharing flow: tag a teammate,
   view-without-signup via email, direct-to-marketplace sharing,
   LinkedIn sharing.
8. A polish pass on roughly 19 small items captured across the Pass A, B,
   and C direction notes footers. Sonnet work, not Fable work.
9. QDeck aggregate-card rendering in the real app. QStackCard currently
   shows a decked stack as a standalone loose card with a generic "In a
   QDeck" badge (wired 2026-07-12). The approved prototype instead
   absorbs a decked stack into its QDeck's own aggregate card (ghost
   layers, deck glyph, no standalone rendering outside the deck page).
   Not a stated rule in the decisions doc, an inference from the
   prototype's data model, so the loose-card-badge version ships as an
   interim state. Needs its own dedicated pass: a real QDeck card
   component, filtering decked stacks out of top-level List/Stack/Board
   views, and the deck page itself, none of which exist in the real app
   yet.
10. Marketplace seller onboarding, locked direction (Plan Mode
    2026-07-12). Listing creation ships; marketplace is not seed-only.
    Three seller paths in priority order: (1) invite-only first cohort
    of 10 to 30, hand-picked by Mo, deliberately mixing brand-domain
    names, high-influence independents, and methodology-strong
    low-profile practitioners; (2) application path reviewed against
    LinkedIn profile plus 2 to 3 of the applicant's own QStacks; (3)
    future seal-gated path at 25 stars. Domain verification (e.g. a
    true @netflix.com address) is an identity-automation tier inside
    paths 1 and 2, not its own path; it clears identity, never quality.
    Badge semantics, LOCKED: user-authored listings carry a
    seller-identity mark meaning "this person is a vetted Argo seller,"
    never a content-verification claim; the mark gets its own color;
    forest green stays exclusive to the Screened badge per D14; per the
    gold-never-carries-meaning-alone rule, any gold mark needs an
    ink-legible twin. Schema requirement: build the seller mark as a
    tiered field, not a boolean, so future levels (e.g. Top Contributor,
    gray vs gold) are data changes, not migrations. OPEN QUESTION,
    capture do not solve: before the seal becomes a commercial
    credential, decide how stars display across contexts; 80 stars
    inside a 5,000-person org are legitimate internal recognition but
    would mislead a marketplace buyer about external validation;
    candidate shapes are cross-org-only counts on marketplace surfaces,
    dual internal/external counts, or weighting; needs its own design
    pass. Visual design of the seller mark (checkmark, shield, scalloped
    certificate, circled avatar, trophy) is a future Phase A HTML
    prototype pass per html-prototype-pass-playbook-v1_0; not
    prose-designed here. Seller onboarding schema and flows go to a
    future Opus Plan Mode session.

## Icebox

Real ideas, explicitly not scheduled, revisited only if they resurface on
their own.

1. Fork lineage lines on the canvas connecting a parent stack to its
   fork. Only earns its complexity once marketplace attribution is real.
2. A deck-fit intelligence layer that warns when a stack looks mismatched
   with the deck it is being added to.

## Standing constraints carried from Goal 1 and 2

1. New migrations only, never edit applied ones. Schema source of truth
   is `buildlog/goal1-build-log.md`, carried forward.
2. Production AI calls stay inside the `ai_calls` CHECK allowlist (Haiku
   or Sonnet); Fable never becomes Argo's runtime model.
3. Every scoring or assessment feature keeps its audit trail and human
   override path from the first migration that touches it.
4. Consent gate before any capture; two-party-consent law, not a
   preference.
5. A permission denial means stop and report to Mo, never re-route to
   the same blocked result (blocked-means-stop rule).

## Schema/backend track: QStack/QDeck data model (approved 2026-07-12)

Plan approved by Mo in plan mode; full plan with DDL at
`~/.claude/plans/plan-the-schema-and-eventual-allen.md`. Scope: migrations,
types, schema only. No UI components, nothing under `prototypes/`.

- [x] Test Author subagent writes failing schema tests (eval-suite style,
      embedded PG), confirms they fail for a valid reason, hands off to
      `.claude/handoff/navigator.md` (39 checks: 38 red for valid
      missing-schema reasons, stars regression guard green)
- [x] Verify tests fail, then write `0013_qstack_stage.sql`
- [x] Write `0014_qdecks.sql` (deck table, nullable composite FK on
      qstacks, RLS)
- [x] Write `0015_canvas_positions.sql` (XOR subject, cascades, partial
      unique indexes, spatial-memory-only comment inline and on-table)
- [x] Write shared row types `src/lib/qdeck.ts`, `src/lib/canvas.ts`
- [x] `db:fresh` applies 0001-0015 clean; new tests green (39/39, after
      a fresh Test Author fixed two checks asserting throw instead of
      RLS zero-row filtering); `eval:rls` still green; type-check passes
- [x] Test Author writes red-first checks for deck stars + set_stack_deck
      (evals/suites/schema-deck-stars.ts, 37 checks: 32 red for valid
      reasons, 5 regression/invariant green)
- [x] Write `0016_deck_stars.sql`: qdecks.star_count (no status field,
      decks carry the seal, never the fleece edge), stars XOR subject,
      partial unique indexes, trigger + stars_insert policy replacement;
      stars never touch canvas position in either direction
- [x] Write `0017_set_stack_deck.sql`: security-definer function, caller
      org membership check, updates only deck_id, qstacks_update NOT
      widened, grant hygiene per 0011
- [x] All suites green locally (deck-stars 37/37, qdeck-canvas 39/39,
      rls-probe, type-check), then STOP and present before hosted
- [x] Surface contract: add the star control on qdeck-card line that
      0016 requires. Done as v1.2 (not an edit to v1.1, which was
      already committed; versioning discipline forced the bump):
      `docs/argo-goal2-surface-contract-v1_2-2026-07-12.md`, testid
      item 38 plus guarantees 6, 11, 12. Committed in 006946f.

## D-ST-10 fix: 0018_revoke_public_execute.sql (separate from track scope,
   flagged 2026-07-12; same red-first + local-then-hosted discipline)

- [x] Test Author writes red-first checks (evals/suites/schema-grant-hygiene.ts):
      PUBLIC does not have EXECUTE on is_org_member(uuid),
      clone_qstack(uuid, uuid), accept_share_invite(text),
      create_org(text), set_stack_deck(uuid, uuid) -- 5/5 FAIL confirmed
      for the correct reason (PUBLIC present in ACL), not a lookup bug
- [x] Write `0018_revoke_public_execute.sql`: revoke execute from public
      on the five exact signatures, confirmed twice against pg_proc
      directly, no overloads
- [x] Apply locally, suite goes 5/5 green (grantee list now
      [postgres, authenticated, service_role], PUBLIC absent); existing
      suites + rls-probe green; type-check hit 2 strict-array-index
      errors in the new suite, fixed by a second Test Author without
      changing behavior, suite stayed 5/5 green throughout
- [x] STOP and present; hold for Mo's go-ahead before hosted
- [x] Mo's go-ahead, 0018 applied to hosted. Verified live via
      aclexplode on pg_proc.proacl (not information_schema): all five
      functions show EXECUTE granted to exactly
      {authenticated, postgres, service_role}, PUBLIC absent, matching
      the local suite's result exactly.
- [x] Mo's final word, then apply 0013-0016/0017 to hosted in ONE pass
      (0017 hit an auto-mode classifier block on first attempt over the
      cross-org bypass-test precondition; Mo re-authorized explicitly,
      retry succeeded). Verified live against hosted: schema shape,
      grant hygiene (found and logged D-ST-10, not fixed here), and an
      11-check hosted-scoped RLS probe run via Supabase MCP since this
      worktree has no DATABASE_URL_HOSTED. All green; zero leftover
      fixture rows.
- [x] `graphify update .`, build log decisions entry (corrected star
      hypothesis) at `buildlog/schema-track-build-log.md`, QA quiz file +
      CHECKLIST line
- [x] Draft surface contract v1.1 amendment (docs only, for UI track):
      `docs/argo-goal2-surface-contract-v1_1-2026-07-12.md`
- [x] Flag to UI track: `QStackRow` in QStackCard.tsx needs `stage` and
      `deck_id` after migrations land (flag once hosted migration is in).
      Wired 2026-07-12: stage pill (neutral dot+pill, stage is free text)
      and a deck-membership badge on both card variants. Local gate green
      (type-check, rls-probe, schema-qdeck-canvas, allowlist, compliance,
      consent, brief; retrieval/anon suites pre-existing/unrelated
      failures, not touched by this change). See
      `docs/architecture/watch-items.md` for the resolved entry and the
      open aggregation question logged below.

## Review

_Empty until the first pass completes._
