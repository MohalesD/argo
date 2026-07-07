# Handoff: eval suite 8.3, brief faithfulness

## Task

Author eval suite 8.3 (brief faithfulness, PRD Section 5.7 and 8.3) with
15 synthetic interview transcripts, and confirm it fails for a valid
reason: the brief module does not exist yet. No implementation code
written; `src/lib/brief.ts` was not created.

## Files created

1. `evals/fixtures/brief-transcripts.json`: 15 synthetic transcripts, 3
   per role family across engineering, sales, people ops, product, and
   finance. Each has `name`, `candidateName` (fictional, deliberately
   unusual so it reads as synthetic), `role`, `traits` (suite-only
   metadata, not part of `generateBrief`'s input contract), and 4 to 7
   `responses` with `id`, `questionText`, `responseText`, `starred`,
   `scoreValue` (1 to 4), and `scoreAnchor`.
2. `evals/suites/brief-faithfulness.ts`: for each transcript, calls
   `generateBrief` (concurrency 6 via `mapWithConcurrency`), then:
   1. Structural integrity, `suite.check()` gate per transcript: every
      claim in `sections[].claims` and `starred_moments` has at least one
      citation and every citation id exists in that transcript's own
      response ids.
   2. Support, `suite.check()` gate, threshold zero: every structurally
      sound claim is judged by `callModel(pool, 'brief_faithfulness_judge',
      ...)` with the claim text plus the full text of its cited
      responses, strict JSON `{"supported": ..., "reason": ...}`, one
      retry on a malformed response (same idiom as
      `src/lib/compliance-classifier.ts`). Structurally unsound claims
      are marked unsupported without a model call, since there is no
      valid cited text to judge against. Judge calls run at concurrency 6
      via `mapWithConcurrency`.
   3. Starred-moment coverage, report-only (no PRD threshold): for every
      starred input response, whether it is cited by at least one claim
      in `starred_moments`. Computed and written into `recordEvalRun`'s
      metrics, never a `suite.check()` gate.
   4. `open_questions` non-empty on the transcripts tagged `contradiction`
      in `traits`, report-only, same treatment as (3).
   Records to `eval_runs` under suite name `brief_faithfulness_8_3`,
   model `claude-sonnet-4-6` (the drafting model; the judge model is
   noted separately in a file comment).

## Transcript design rationale

Five control transcripts (`eng-control-01`, `sales-control-01`,
`peopleops-control-01`, `product-control-01`, `finance-control-01`) give
each role family a clean baseline: every claim a well-behaved brief
would plausibly draft is fully grounded in a stated fact, so a passing
suite on these alone would not by itself prove the faithfulness bar
means anything. The other ten transcripts are adversarial by design,
covering all three categories the task named:

1. Unstated-fact transcripts (`eng-unstated-01`, `sales-unstated-01`,
   `peopleops-unstated-01`, `product-unstated-01`, `finance-unstated-01`),
   one per role family: the candidate describes real ownership of a
   project, a strong sales year, an onboarding program, a shipped
   feature, or a managed budget, but the transcript never states the one
   number a brief-writer would be tempted to invent: team size, quota
   percentage, employee count, user count, or budget size. Any brief
   claim asserting that number has no supporting citation text and must
   fail the judge.
2. Contradiction transcripts (`eng-contradiction-01`,
   `sales-contradiction-01`, `product-contradiction-01`, plus
   `finance-ambiguous-contradiction-01`): one response states a fact
   (no Kubernetes production experience, enterprise-only focus, never
   launched a product zero to one, limited FP&A experience) and a later
   response directly contradicts it (led a Kubernetes migration, sold to
   a small business, built and launched a mobile app from scratch, built
   an FP&A forecasting model). A faithful brief citing only one side is
   fine; a brief that resolves the contradiction into a single confident
   claim without flagging the tension is the failure mode this category
   exists to catch, which is why `open_questions` on these four
   transcripts is checked as a report-only signal that the generator at
   least noticed the tension.
3. Ambiguous/hedged transcripts (`peopleops-ambiguous-01`, and
   `finance-ambiguous-contradiction-01` again): the candidate answers in
   heavily hedged language ("I think", "I guess", "it probably", "I'm
   not totally sure") with no concrete claim to ground a confident brief
   sentence on. A brief that converts hedged self-report into a
   confident factual claim is unsupported by the judge's standard.

`finance-ambiguous-contradiction-01` deliberately stacks two categories
on one transcript (6 responses, the widest in the set) to check the
generator against compounding failure modes in a single interview
rather than assuming each adversarial pattern only ever shows up in
isolation.

## How to run

Local (default, no `ARGO_DB` set, local Postgres on `127.0.0.1:5799`):
`npm run eval:brief`.

## Observed failure output, confirmed valid

Confirmed first that `src/lib/brief.ts` does not exist:
`ls src/lib/brief.*` returned "No such file or directory". No database
needs to be running to observe this failure: static ESM import
resolution happens before any of the suite's top-level code (fixture
read, `adminPool()`, judge calls) executes.

```
> argo@0.1.0 eval:brief
> tsx evals/suites/brief-faithfulness.ts

node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\mohal\argo\src\lib\brief.js' imported from C:\Users\mohal\argo\evals\suites\brief-faithfulness.ts
    ...
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///C:/Users/mohal/argo/src/lib/brief.js'
}
```

Exit code 1. `generateBrief` is imported as a real value (called later
in the file), not `import type`, so esbuild could not elide the import
statement; it reached Node's module resolver and failed exactly on the
missing `brief.js`, not on a parse or syntax problem in the suite file.

Also ran `npx tsc -p tsconfig.scripts.json --noEmit` to confirm no
independent bug exists in the suite. It reports 4 errors, all traceable
to the same missing module: two `TS2307: Cannot find module
'../../src/lib/brief.js'` (the import itself), and two cascading
`TS7006: implicitly has an 'any' type` on parameters whose types flow
from the now-unresolved `BriefClaim` and `BriefContent` types. Both
implicit-any errors resolve on their own once `brief.ts` exists and
exports real types; neither reflects an independent typo. `src/lib/brief.ts`
was not created.
