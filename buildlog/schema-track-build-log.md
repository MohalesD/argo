# Schema/Backend Track Build Log: QStack/QDeck Data Model

**July 12, 2026. Branch `schema-backend-track`. Fable 5 executing an
approved plan-mode plan (full DDL and reasoning in the plan file;
summary here). Scope: migrations, types, schema only. No UI components,
nothing under `prototypes/`.**

## What shipped

1. `supabase/migrations/0013_qstack_stage.sql`: `qstacks.stage`, text
   not null default '', a real column, never parsed from title.
2. `supabase/migrations/0014_qdecks.sql`: `qdecks` table (org-scoped,
   RLS), plus nullable `qstacks.deck_id` with a composite foreign key
   `(deck_id, org_id) -> qdecks (id, org_id)` and column-targeted
   `on delete set null (deck_id)`.
3. `supabase/migrations/0015_canvas_positions.sql`: `canvas_positions`,
   XOR subject (stack or deck), cascade deletes, partial unique indexes,
   org-scoped RLS, spatial-memory-only rule inline and as
   `comment on table`.
4. `src/lib/qdeck.ts`, `src/lib/canvas.ts`: shared row contracts,
   brief.ts precedent.
5. `docs/argo-goal2-surface-contract-v1_1-2026-07-12.md`: Canvas as
   fourth surface (testids, locality rule, input parity, three new
   behavioral guarantees). v1.0 stays archived.
6. `evals/suites/schema-qdeck-canvas.ts`: 39-check schema suite,
   written red-first by a Test Author subagent, green after the
   migrations. Existing `eval:rls` and `type-check` also green.

## Verification state

Local embedded Postgres (17.10): fresh rebuild applies shim plus all 15
migrations clean. `schema-qdeck-canvas` 39/39 PASS. `rls-probe` fully
green. `type-check` clean. Hosted (17.6) NOT yet migrated; awaiting
Mo's go-ahead per plan.

## Decisions table

| # | Decision | Rejected alternative / correction |
| --- | --- | --- |
| D-ST-1 | No star-uniqueness migration: `unique (user_id, qstack_id)` has existed since 0005, hosted has zero duplicates (zero star rows) | Corrects the sprint working hypothesis that star dedupe was the first, riskiest migration; it was already done |
| D-ST-2 | `stage` is free text, no CHECK enum | Fixed stage vocabulary; D15 precedent says org-defined flows, and a CHECK would cost a migration per vocabulary change |
| D-ST-3 | Canvas spatial memory is org-shared; per-user is a documented, purely additive future migration (nullable user_id plus partial-index swap, no rewrite) | Per-user from day one; Mo confirmed org-shared with the additive door verified open |
| D-ST-4 | Canvas positions cover stacks AND decks via XOR (`num_nonnulls = 1`), cascade on both parents | Stacks-only table; decks are first-class and sit on the canvas |
| D-ST-5 | Same-org deck membership enforced by composite FK, binding every caller including service role | Enforcement by trigger or application code |
| D-ST-6 | Position rows are durable: deck membership never deletes or alters them, so a loose stack reappears at its remembered spot | Deleting positions on deck join, which would strand returning stacks at the origin |
| D-ST-7 | Cross-org UPDATE/DELETE blocking is asserted as zero-rows-plus-unchanged-content, not as a thrown error | expectReject on RLS-filtered writes; Postgres filters invisible rows silently, it does not throw. Two checks misreported failure until a fresh Test Author fixed the assertion style |

## Watched items

1. UI track owns adding `stage` and `deck_id` to `QStackRow` in
   `src/components/library/QStackCard.tsx` after these migrations land;
   flagged, not touched here.
2. Deck assignment inherits the `qstacks_update` policy (owner or org
   admin), while Kanban placement allows any org member. Asymmetry
   flagged to Mo; unchanged by decision of scope.
3. The loose-stack seeding rule (near the departed deck, never at the
   origin) is a UI-track contract in surface contract v1.1, guarantee 9;
   schema guarantees only that the position row survives.
