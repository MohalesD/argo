# Handoff: fixture questions born invisible

## Task

Eval suites `rls-probe.ts` and `consent.ts` inserted fixture QUESTIONS with
`screening_status = 'passed'`, `verification = 'screened'`. Under RLS policy
`questions_select_passed` (0007_rls_policies.sql, line 155), any 'passed'
question is publicly visible to `anon` and `authenticated`. Fixture rows
persist on the hosted database and cannot be cascade-deleted because the
scores append-only trigger correctly blocks it, so the fixtures were leaking
into the shared public question bank. Task: make fixture questions born
invisible instead. No implementation code touched. No migrations or triggers
touched.

## Files changed

1. `evals/suites/rls-probe.ts`, one INSERT (function `buildOrgGraph`, the
   `q` fixture, the one WITH a category/role_family/rationale, not the
   `pendingQ` one).
2. `evals/suites/consent.ts`, one INSERT (the module-level `q` fixture).

In both, `screening_status` changed from `'passed'` to `'flagged'`,
`verification` changed from `'screened'` to `null`, and a new
`flag_reason` column value `'suite fixture, not bank content'` was added
to the INSERT list and VALUES. Column lists and placeholders were updated
to match. No other lines in either file were touched. The deliberately
pending fixture in `rls-probe.ts` (`pendingQ`, screening_status 'pending')
was left exactly as is, per instruction, since the `pending_questions`
probe depends on it.

## Why this is safe (meaning check, done before editing)

Read both files in full first.

`rls-probe.ts`: the `crossOrgProbes` list counts rows across qstacks,
qstack_items, kanban_columns, interviews, qstack_positions,
interview_sessions, consents, responses, scores, briefs, brief_shares,
profiles, notifications, and one explicit `pending_questions` probe on
the pending fixture's id. There is no probe that queries `questions` by
id or that depends on the flagged question's own screening_status or
verification value. The flagged question is referenced only as a foreign
key from `qstack_items` and `responses`, both of which are visibility
tests on the qstack_item/response row itself, not on the question row.
Positive controls (own qstack, own session) and the write-block probe
also do not touch the question's screening_status. Verdict: no check's
meaning depends on the fixture question being 'passed'.

`consent.ts`: the module-level `q` fixture is inserted and its `id` is
never referenced again anywhere in the file (confirmed by grep, zero
matches for `q.rows` after the insert). It is not even used as a foreign
key; every downstream table (qstacks, interviews, interview_sessions,
consents) is built independently of it. Verdict: changing its status has
zero effect on any check in this suite.

Also confirmed via schema: `flagged` is a valid `screening_status` value
(check constraint, 0002_qstacks_questions.sql line 15), `verification`
accepts `null` (0002_qstacks_questions.sql line 20, only non-null values
are constrained to 'screened'/'verified'), and both suites connect via
`adminPool()` (src/lib/db.ts), the Postgres superuser, which bypasses RLS
entirely, so the RLS insert policy requiring `screening_status = 'pending'`
for authenticated inserts does not apply to these fixture inserts.

No check meaning changed. Nothing was left unchanged that should have
been flagged.

## Verification, both green

`npm run eval:rls`: 34 checks, all PASS, suite recorded to eval_runs as
GREEN.

`npm run eval:consent`: 9 checks, all PASS, suite recorded to eval_runs
as GREEN.

## Confirmed: no fixture question entered the public bank

Queried local Postgres (127.0.0.1:5799, database argo) for questions with
text like 'Probe question %' or 'Consent probe question' created in the
last 10 minutes. 3 rows found (2 from rls-probe, 1 from consent), all 3
`screening_status = 'flagged'`, `flag_reason = 'suite fixture, not bank
content'`, `verification = null`. Zero non-flagged fixture rows. None of
these rows are selectable through `questions_select_passed`; each remains
visible only to its `contributed_by` author (rls-probe fixtures) or to no
authenticated user at all (consent fixture, contributed_by is null there).
