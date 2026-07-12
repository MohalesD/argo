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
   KanbanBoard() and dnd-kit drag mechanic, does not rebuild it.
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
- [ ] Flag to UI track: `QStackRow` in QStackCard.tsx needs `stage` and
      `deck_id` after migrations land (flag once hosted migration is in)

## Review

_Empty until the first pass completes._
