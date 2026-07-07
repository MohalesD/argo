# Handoff: eval suite 8.1, retrieval quality

## Task

Author eval suite 8.1 (retrieval quality, PRD Section 8.1 and 5.3) with
fixtures, and confirm it fails for a valid reason: the retrieval module
does not exist yet. No implementation code written; `src/lib/retrieval.ts`
was not created.

## Files created

1. `evals/fixtures/retrieval-fixtures.json`: 25 query fixtures across all
   10 role families in `seed/questions/*.json` and all 4 levels (junior,
   mid, senior, lead). Each fixture has a name, a `RetrievalQuery` (some
   combination of `roleFamily`, `level`, `category`, `search`), a one-line
   interviewer-intent `context` for the re-ranker, and a `relevant` array
   of 4 to 10 question texts copied verbatim from the seed files.
2. `evals/suites/retrieval.ts`: runs `retrieveQuestions` (limit 20) then
   `rerankQuestions` per fixture, resolves each fixture's relevant texts
   to ids at run time, takes the top 5 re-ranked results, and checks:
   1. mean precision at 5 across all 25 fixtures is at least 0.6.
   2. zero flagged questions in any result, checked by querying
      `screening_status` directly for both the retrieval candidates and
      the re-ranked top 5, not by trusting the module's contract.
   3. zero pending questions, same two-stage check.
   4. every re-ranked result id was present in the candidate set the
      re-ranker was given.
   5. every re-ranked result carries a non-empty `fitReason`.
   6. every fixture's relevant texts resolved to an id in the current
      bank (guards against a fixture text drifting from the seed file).
   Records to `eval_runs` under suite name `retrieval_8_1`, model
   `claude-sonnet-4-6`, with `meanP5` and the full per-fixture breakdown
   in metrics. Respects `DATABASE_URL` through `adminPool()`; run against
   the hosted project with `ARGO_DB=hosted npm run eval:retrieval`.

## Fixture design rationale

Each fixture's query is deliberately not over-narrowed: most set
`roleFamily` plus one of `level` or `category` (not both stacked on the
smaller categories), because stacking all three filters on the smaller
levels (`lead` in particular runs 2 to 4 questions per family) can shrink
the structured-filter candidate pool below the 4-item relevant floor
before the re-ranker ever runs. Where a family's `lead` pool was too thin
to support a `level: "lead"` fixture on its own (only `product_management`
has exactly 4 lead questions), the fixture instead filters on
`category: "role"` without a level, and the `context` field carries the
seniority intent instead (`customer_success_lead_track_portfolio_scope`,
`design_lead_track_design_leadership`). This mirrors how the product
actually works per PRD 5.3: structured filters narrow the pool, Sonnet's
re-rank against the interviewer's stated context does the precision work,
not the query filters alone. One fixture per role family with 4 total
candidates (`product_management_lead_scope_and_leadership`) intentionally
marks all 4 as relevant, an honest corner case rather than a padded one.

Every `relevant` text was verified programmatically against its source
seed file: exact string match, correct `level` and `category` alignment
with the fixture's query filters, and (for the one `search`-driven
fixture, `sales_deal_specific_storytelling`, `search: "deal"`) literal
presence of the search term in the question text. None of the 5
deliberately non-compliant questions in `seed/known-flagged.json` (all
tagged `role_family: "engineering"`) were used; none of their texts
overlap with `engineering.json`'s real 30 questions, so no explicit
exclusion logic was needed beyond checking for it.

## Model-judged-relevance caveat

The PRD calls for "human-judged relevant sets." These 25 relevant sets
were judged by the Test Author subagent (me) after reading every seed
question in `seed/questions/*.json` in full, using a competent
interviewer's plausible top-5 preference as the standard, not a
mechanical keyword match. This is a stand-in for the PRD's human
judgment, not the real thing. Flagged for Mo's spot check before this
suite's P@5 threshold is treated as a durable ground truth: a handful of
"borderline excluded" calls per fixture (for example, whether a
motivation-category question belongs in a skill-focused screen) reflect
one AI's judgment about interviewer intent, not a hiring manager's.

## How to run

Local (default, no `ARGO_DB` set): `npm run eval:retrieval`. Targets the
embedded Postgres on `127.0.0.1:5799`, database `argo`, the same bank
described in `docs/argo-build-log-*` for Goal 1.

Hosted: `ARGO_DB=hosted npm run eval:retrieval`. Requires
`DATABASE_URL_HOSTED` in `.env.local`.

## Observed failure output, confirmed valid

Ran `npm run eval:retrieval` locally, no `ARGO_DB` set. Confirmed first
that `src/lib/retrieval.ts` does not exist (`ls src/lib/` has no match).
Output:

```
> argo@0.1.0 eval:retrieval
> tsx evals/suites/retrieval.ts

node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\mohal\argo\src\lib\retrieval.js' imported from C:\Users\mohal\argo\evals\suites\retrieval.ts
    ...
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///C:/Users/mohal/argo/src/lib/retrieval.js'
}
```

Exit code 1. This is the static `import { retrieveQuestions,
rerankQuestions, type RetrievedQuestion } from '../../src/lib/retrieval.js'`
failing to resolve, before any suite code (fixture loading, `adminPool()`,
DB connection) executes. Failure reason is exactly missing behavior (the
module does not exist), not a typo or a syntax error: `esbuild` (via
`tsx`) must fully parse the suite file to discover its imports before
attempting resolution, and it reached the resolution step cleanly with no
transform diagnostic, meaning `evals/suites/retrieval.ts` itself is
syntactically valid. `src/lib/retrieval.ts` was not created.
