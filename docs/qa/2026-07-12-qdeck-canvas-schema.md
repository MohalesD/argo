# QA: QDeck/Canvas schema track (2026-07-12)

## Files changed

1. `supabase/migrations/0013_qstack_stage.sql` (new)
2. `supabase/migrations/0014_qdecks.sql` (new)
3. `supabase/migrations/0015_canvas_positions.sql` (new)
4. `src/lib/qdeck.ts` (new)
5. `src/lib/canvas.ts` (new)
6. `docs/argo-goal2-surface-contract-v1_1-2026-07-12.md` (new; v1.0
   stays archived)
7. `evals/suites/schema-qdeck-canvas.ts` (new, Test Author subagents)
8. `.claude/handoff/navigator.md` (new, Test Author handoff)
9. `buildlog/schema-track-build-log.md` (new)
10. `tasks/todo.md` (track checklist added)

## Logic in one sentence

QDeck becomes a first-class org-scoped entity with a nullable,
same-org-constrained deck membership on each stack, stage becomes a
real column, and canvas spatial memory gets its own XOR-subject,
org-shared, RLS-scoped table that can never feed ordering or
assessment.

## Quiz

**Q: Why does `canvas_positions` use partial unique indexes instead of
table-level UNIQUE constraints, and what breaks if a future session
"cleans that up"?**

A: Two reasons. First, both subject columns are nullable (XOR), and a
plain UNIQUE on a nullable column technically works but couples
uniqueness to the whole-column shape; the partial index states the real
rule (one position per non-null subject) exactly. Second, and the one
that bites later: the committed migration path to per-user canvas
memory swaps these indexes for versions with a `user_id is null` /
`user_id is not null` predicate while existing rows stay valid as the
org-shared baseline. A table-level UNIQUE constraint cannot carry that
predicate, so "simplifying" the partial indexes into constraints would
close the additive door Mo required to be verifiably open before
approving org-shared. PASS.

## Verification

Local: fresh embedded Postgres applies all 15 migrations clean; the
56-check schema suite is green (written red-first by a Test Author);
`eval:rls` green; `type-check` green. Hosted: not yet migrated,
awaiting Mo's explicit go-ahead.

**Correction, 2026-07-12 (post-merge verification on `main`):** this
entry originally said "39-check." Re-running `evals/suites/schema-
qdeck-canvas.ts` against a genuinely fresh database on `main` produced
56 checks, all passing. Traced the file line by line: every
`suite.check()` and `scenario()` call is a single, unconditional,
top-level statement (six under Criterion 1, sixteen under Criterion 2,
six under Criterion 3, twenty-seven under Criterion 4, one regression
guard under Criterion 5 = 56); no loop, no conditional gate, and no
`process.env` reference controls how many checks run, so the count is
fixed in the source and cannot vary by runtime state. 56 is correct;
39 was a reporting error made earlier in the same session, not a count
that ever actually ran. Left as a visible correction rather than a
silent edit.
