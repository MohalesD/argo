# QA: deck stars and set_stack_deck (2026-07-12)

## Files changed

1. `supabase/migrations/0016_deck_stars.sql` (new)
2. `supabase/migrations/0017_set_stack_deck.sql` (new)
3. `src/lib/qdeck.ts` (star_count added to QDeckRow)
4. `evals/suites/schema-deck-stars.ts` (new, Test Author subagent)
5. `docs/argo-goal2-surface-contract-v1_2-2026-07-12.md` (new; v1.1
   stays archived)
6. `.claude/handoff/navigator.md` (Test Author section appended)
7. `buildlog/schema-track-build-log.md` (shipped items 7-10, D-ST-8
   marked built, D-ST-9 added)
8. `tasks/todo.md` (checkboxes)

## Logic in one sentence

Stars gain a deck subject through the same XOR-plus-partial-index shape
canvas positions use, with seal parity at 25 or more and no status field
on decks, and deck assignment opens to any org member through a
security-definer function that can move only deck_id.

## Quiz

**Q: Why does maintain_star_count get replaced via `create or replace`
in 0016 rather than editing migration 0008, and what does that imply
for every future change to a trigger function?**

A: Applied migrations are immutable history ("new migrations only,
never edit applied ones", standing constraint 1); hosted has already
run 0008, so editing it would fork local and hosted realities. `create
or replace function` in a NEW migration supersedes the body atomically
while the trigger binding from 0008 stays valid, because the trigger
references the function by name, not by body. The implication: every
future trigger-function change is a new migration replacing the
function, and the latest migration to touch a function is its single
source of truth, which is why 0016's header notes it replaces the 0008
body. PASS.

## Verification

Local fresh rebuild applies all 17 migrations clean.
`schema-deck-stars` 37/37 green (was 32 red / 5 regression-green before
implementation), `schema-qdeck-canvas` still 39/39, `rls-probe` green,
`type-check` clean. Hosted untouched; 0013 through 0017 apply in one
pass on Mo's final word.
