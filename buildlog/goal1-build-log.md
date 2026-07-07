# Argo Goal 1 Build Log: Backbone
**July 7, 2026 · Authored during the run by Claude Fable 5 · Goal 1 of 3 per PRD v1.0 Section 9**

## What was built

Schema and migrations for all PRD Section 6 tables (25 physical tables;
the PRD's numbered list has 24 items, item 10 holds two tables), with
row-level security enforcing org-scoped tenancy, the ai_calls model
allowlist CHECK constraint, a consent-gated interview session state
machine, append-only scores, a model registry with two transports, the
compliance classifier on Haiku, eval suites 8.2 and 8.5 green with
results persisted to eval_runs, and a screened seed bank across 10 role
families. No UI surfaces, per scope.

## Environment facts that shaped the build

1. No Docker on this machine, so no local Supabase stack. Verification
   runs against embedded Postgres 17.5 (real binaries via npm) with a
   thin shim providing the `auth` schema, `auth.uid()`, and the
   anon/authenticated/service_role grant model that hosted Supabase
   provides out of the box.
2. No ANTHROPIC_API_KEY in the environment. Model calls run through the
   Claude CLI headless (`claude -p --model claude-haiku-4-5`), a real
   Haiku call on the authenticated CLI. The production API transport is
   built and gated by the same registry but untested here.

## Done criteria, verified

1. **Migrations run clean on a fresh database.** `npm run db:fresh`
   wipes the data directory, initializes Postgres from zero, applies the
   shim and all 8 migrations. Repeated clean runs throughout the build.
2. **Two-user RLS probe passes.** Suite `rls_probe` in eval_runs: two
   users in two orgs, 35 checks green. Cross-org reads return zero rows
   across every org_id table (orgs, org_members, qstacks,
   kanban_columns, interviews), every chained table
   (qstack_items, qstack_positions, interview_sessions, consents,
   responses, scores, briefs, brief_shares), private profiles,
   notifications, and pending questions. Positive controls confirm RLS
   is not simply denying everything, and a cross-org write probe fails
   as required.
3. **Mythos and Fable-tier inserts into ai_calls fail.** Suite
   `model_allowlist`: `claude-fable-5`, `claude-mythos-5`,
   `claude-opus-4-8`, and a dated legacy Opus string all rejected with
   SQLSTATE 23514 (check violation), attempted as a privileged caller.
   Both allowlisted strings insert. The constraint definition is
   verified to contain exactly the two production models. The registry
   additionally rejects disallowed models in-process before any
   transport is touched.
4. **Seed bank queryable, every question carries screening_status.**
   [PENDING-SEED]
5. **Suites 8.2 and 8.5 green in eval_runs.**
   `compliance_8_2`: 64 labeled fixtures, illegal recall 1.0
   (22/22, zero illegal classified safe), flagged precision 1.0,
   perfect confusion matrix on the first full run; no prompt tuning was
   required after the initial three-question spot check.
   `consent_8_5`: 9 checks green, including created-to-capturing
   attempts as an authenticated user and as a privileged service
   caller (both blocked by trigger), sessions born past 'created'
   rejected, the legitimate consent path reaching capture, ended as a
   terminal state, and re-verification of the consent record at
   capture time.

## Decisions table

| # | Decision | Reasoning and rejected alternative |
| --- | --- | --- |
| D-G1-1 | Embedded Postgres (npm, PG 17) as the local verification database, with a Supabase parity shim | No Docker on the machine. Rejected: remote-only verification (slower loop, cost confirmation) and pg-mem (no real RLS). Hosted parity is a could-not-verify item. |
| D-G1-2 | Claude CLI headless as dev transport when no API key is present; registry enforces the allowlist regardless of transport | Real Haiku calls on the authenticated CLI beat a mock (nothing faked on the critical path). Rejected: stub classifier (fakes the eval), asking for a key mid-run (autonomous directive). |
| D-G1-3 | questions.role_family and questions.level as first-class columns | PRD 5.3 filters retrieval on both; Section 6's field list omits them. Indexed columns beat provenance-jsonb keys for filtering. |
| D-G1-4 | questions.flag_reason column added | PRD 5.3: flagged questions remain visible to their author with the flag reason. The reason needs a home. |
| D-G1-5 | verification badge is null until earned; set to 'screened' only when the classifier passes a question | Keeps the D14 honesty rule structural: no badge before screening, 'verified' reserved for the future editorial tier. |
| D-G1-6 | Pending questions are author-only visible, same isolation as flagged | PRD states the flagged rule; unscreened content surfacing would break the same honesty claim, so pending inherits the restriction. |
| D-G1-7 | Classifier policy: only 'safe' earns 'passed'; both 'risky' and 'illegal' store as 'flagged' with reason. The 8.2 threshold is operationalized exactly as the PRD parenthetical states it: zero illegal-labeled fixtures classified safe | Conservative bank policy; risky questions are jurisdiction-dependent and should not surface as screened. Strict recall and flagged precision are reported alongside (both 1.0 on this run). |
| D-G1-8 | interviews.status values: scheduled, completed, canceled | PRD names the column but not the values. Minimal set serving Goal 2's surfaces. |
| D-G1-9 | Org creation via a security-definer create_org() that atomically inserts the org and its owner membership | Avoids the bootstrap hole in org_members' admin-only insert policy. Rejected: a permissive first-member policy (wider attack surface). |
| D-G1-10 | Scores append-only enforced by trigger (binds service_role and table owner), plus a supersede-chain check that corrections reference a score on the same response; sessions can only be born in 'created'; 'ended' is terminal | An audit trail you can edit is not an audit trail (D11); RLS alone does not bind privileged callers. |
| D-G1-11 | rls_probe and model_allowlist persist to eval_runs alongside the numbered suites | One place to see all verification results; harmless addition to the PRD's eval_runs contract. |
| D-G1-12 | Remote Supabase provisioning deferred to Goal 2 | The active existing project belongs to Ada (a different product); the paused one has unknown contents; creating a new project requires a cost confirmation that belongs to Mo, not to an autonomous run. No Goal 1 done criterion requires a hosted database. Flagged once per posture: hosted magic-link auth config is therefore also deferred; schema-side auth support (auth.users trigger into public.users) is built and exercised by every probe fixture. |
| D-G1-13 | briefs.generated_by_model carries the same allowlist CHECK, nullable | A brief claiming generation by a non-allowlisted model should be structurally impossible too; null covers human-only briefs. |
| D-G1-14 | brief_shares.token defaults to a 32-hex random token; expires_at defaults to now() + 30 days in the schema | D13 made expiry and revocability the minimum responsible handling; defaults in the schema mean no code path can forget them. |
| D-G1-15 | Seed provenance states plainly: drafted with Claude Fable 5 under Argo editorial direction, screened by claude-haiku-4-5 | The product's central honesty claim applies to its own bank first. Rejected: vague "expert-curated" language that would overstate the current editorial depth. |

## Eval results (persisted to eval_runs)

| Suite | Result | Key metrics |
| --- | --- | --- |
| rls_probe | GREEN | 35/35 checks, both directions, zero cross-org rows |
| model_allowlist | GREEN | 9/9; four forbidden model strings rejected (SQLSTATE 23514) |
| compliance_8_2 | GREEN | illegal recall 1.0 (22/22), flagged precision 1.0, 64 fixtures |
| consent_8_5 | GREEN | 9/9 including privileged-path bypass attempts |

## Seed bank

[PENDING-SEED]

## Cost review (ai_calls)

[PENDING-SEED]

## Could not verify

1. **Hosted-Supabase parity of the local shim.** auth.uid(), the role
   grant model, and default privileges mirror the hosted definitions,
   but the probes ran on embedded Postgres, not on a hosted project.
   Mitigation: Goal 2 applies the same migrations to a real project and
   reruns rls_probe and consent_8_5 there before any real data exists.
2. **The Anthropic API transport path.** Built against the current SDK
   (claude-api skill reference), but never executed here because no API
   key exists in this environment. The registry and allowlist gate both
   transports identically. Test on first key availability.
3. **The UI path of eval 8.5.** The PRD specifies consent bypass
   attempts via UI and direct API; no UI exists until Goal 2. The API
   and privileged paths are covered; the UI path is a Goal 2 must-do.
4. **Classifier variance across reruns.** Suite 8.2 was green on its
   single full run plus spot checks; run-to-run variance was not
   measured. The suite is cheap to rerun and is wired into eval_runs
   for exactly that.
5. **Dev-transport token accounting.** The CLI reports usage including
   its own wrapper overhead, so ai_calls token counts and costs from
   this run are an upper bound, not exact API-parity numbers.
6. **Magic-link auth end to end.** Requires a hosted project and a UI;
   deferred with D-G1-12. The schema-side signup mirror
   (auth.users to public.users trigger) is built and exercised by every
   test fixture in the suites.

## Watched items carried forward to Goal 2

1. Rerun rls_probe and consent_8_5 against the hosted Supabase project
   after migrations apply there (closes could-not-verify 1).
2. UI-path consent test once interview mode exists (closes 3).
3. Marketplace anon-browse policies exist; confirm they match the Goal 2
   surface design before exposing publicly.
4. Tokenized brief access for anon viewers is deliberately not an RLS
   path; it needs a definer function or edge function in Goal 2.
