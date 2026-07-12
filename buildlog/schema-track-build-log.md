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
7. `supabase/migrations/0016_deck_stars.sql`: deck-owned stars.
   `qdecks.star_count` (seal parity at 25+, deliberately no status
   field, decks never carry the fleece edge), `stars` gains an XOR
   subject (nullable qstack_id, nullable deck_id, exactly one set),
   scarcity via two partial unique indexes, star-count trigger and
   stars_insert policy replaced to cover both subjects. Stars and
   canvas position stay fully isolated in both directions.
8. `supabase/migrations/0017_set_stack_deck.sql`: the D-ST-8 fix.
   Security-definer `set_stack_deck(p_stack, p_deck)` verifies caller
   org membership and updates only deck_id; `qstacks_update` untouched;
   anon execute revoked per the 0011 pattern.
9. `evals/suites/schema-deck-stars.ts`: 37-check suite for 0016/0017,
   written red-first by a fresh Test Author (32 red, 5 regression/
   invariant green), fully green after the migrations.
10. `docs/argo-goal2-surface-contract-v1_2-2026-07-12.md`: deck star
    controls and the set_stack_deck guarantee; v1.1 stays archived.

## Verification state

Local embedded Postgres (17.10): fresh rebuild applies shim plus all 17
migrations clean. `schema-qdeck-canvas` 39/39 PASS, `schema-deck-stars`
37/37 PASS, `rls-probe` fully green, `type-check` clean.

Hosted (17.6, project rtqgisbotvxidvzphyhn): 0013 through 0017 applied
2026-07-12, one migration per `apply_migration` call, in order. Applying
0017 was initially blocked by the Claude Code auto-mode permission
classifier (it could not itself confirm the cross-org bypass test
precondition from the transcript); Mo re-authorized explicitly and it
applied clean on retry. All five confirmed live via `list_migrations`.

Post-apply verification against hosted directly (not inferred from the
local run):
1. Schema shape: `stars` carries `stars_one_subject` CHECK
   (`num_nonnulls(qstack_id, deck_id) = 1`) plus both partial unique
   indexes (`stars_user_qstack_key`, `stars_user_deck_key`); `qdecks`
   has exactly `{id, org_id, owner_id, title, created_at, star_count}`,
   no status column; `canvas_positions` carries the spatial-memory-only
   `comment on table`; `set_stack_deck(uuid, uuid)` exists,
   `prosecdef = true`.
2. Grant-hygiene finding (pre-existing, not introduced by this track):
   `set_stack_deck`'s EXECUTE grant list includes `PUBLIC`, same as
   every other definer function on hosted (`is_org_member`,
   `clone_qstack`, `accept_share_invite`, `create_org`). The 0011
   pattern only ever revoked from `anon` specifically; Postgres grants
   EXECUTE to PUBLIC by default on function creation, and every role
   implicitly inherits PUBLIC grants, so the anon-specific revoke never
   actually closed the door on any of these functions, on hosted, this
   migration included. Not fixed here (Goal 1 scope, not this track's).
   Practical exposure for `set_stack_deck` specifically is low: its own
   internal `is_org_member(auth.uid())` check rejects any caller
   without a valid authenticated `auth.uid()`, which anon never has, so
   the function is callable but never effective for anon. Logged as
   D-ST-10 below and as a watch item; the real fix is
   `revoke execute on function ... from public` across all definer
   functions, a systemic pass outside this track.
3. Two-user RLS probe against hosted directly: the actual
   `evals/suites/rls-probe.ts` script could not target hosted from this
   worktree (`DATABASE_URL_HOSTED` is not present in this worktree's
   `.env.local`, which Mo manages personally). Ran an equivalent probe
   via the Supabase MCP instead: two fixture orgs/users, role-switched
   with `SET LOCAL ROLE authenticated` plus `request.jwt.claims`
   (the same technique `evals/lib/harness.ts`'s `asUser` uses), scoped
   to the surfaces this track changed. 11 of 11 checks passed: alpha
   sees and stars its own deck (star_count increments to 1),
   `set_stack_deck` assigns live on hosted, beta cannot see the deck,
   its canvas position, its star, or the now-decked stack, and beta's
   direct attempts to insert a canvas position, insert a star, or call
   `set_stack_deck` on alpha's stack are all rejected by RLS. Entire
   probe ran inside one uncommitted transaction; connection close
   auto-aborted it; a follow-up query confirmed zero leftover rows.
   This is a scoped hosted-specific check, not a re-run of all sixteen
   tables in the local `rls-probe.ts` suite (those tables' RLS is
   unchanged by 0013-0017 and already verified green locally).

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
| D-ST-8 | Deck assignment currently restricted to stack owner or org admin only, an accident of column placement (deck_id sits on the qstack row and inherits qstacks_update), not a deliberate decision. Correct model is any org member, same gesture class as Kanban placement; the design doc's deck page assumes assembly from stacks the caller does not own. | Fix is a narrow security-definer function set_stack_deck(p_stack, p_deck) per the 0010_definer_functions.sql precedent, not widening qstacks_update. Built in 0017, red-first tested. |
| D-ST-9 | Deck-owned stars share the stars table via XOR subject (nullable qstack_id/deck_id, exactly one set), scarcity per subject via partial unique indexes, cached qdecks.star_count, seal parity at 25+ | A separate deck_stars table (two tables for one concept fragments the seal rule and the scarcity story); a status field on qdecks (rejected: decks carry the seal, never the fleece edge, per design decisions v1.0) |
| D-ST-10 | The 0011 grant-hygiene pattern (revoke EXECUTE from anon) does not close PUBLIC's default EXECUTE grant; every definer function on hosted, including set_stack_deck, remains PUBLIC-executable. Left unfixed here: pre-existing, systemic, Goal 1 scope. Practical exposure on set_stack_deck is low (its own auth.uid() membership check rejects anon regardless). | Fixing it inside this track's migrations; a systemic revoke-from-PUBLIC pass belongs to whichever track owns Goal 1 grant hygiene, not a one-off patch buried in 0017 |

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
4. Stage is free text (D-ST-2) with no CHECK, no enum, and no lookup
   table. This is fine while stage values are seeded, but nothing
   prevents drift ("onsite" vs "Onsite" vs "on-site") once users type
   them. The backlog already commits to stage becoming user-defined and
   unbounded once pipelines are customizable by department and position,
   which is the point at which an org-scoped stages lookup table with an
   order_index becomes the right shape. Revisit before the Board's
   responsive rail count work, since that work depends on stage being
   real, ordered data.
