# Argo Goal 1: Backbone — Implementation Plan

> **For agentic workers:** Executing inline in-session via superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Schema, migrations, RLS tenancy, model allowlist constraint, screened seed bank, and eval suites 8.2 + 8.5 green with results in `eval_runs`, per PRD v1.0 Sections 4, 6, 8.2, 8.5, 9.

**Architecture:** Supabase-shaped Postgres schema in `supabase/migrations/`, verified locally against embedded Postgres (no Docker on this machine) with a thin shim for Supabase's `auth` schema and roles. Model calls go through a registry that enforces the PRD 4.4 allowlist before any transport; transports are Anthropic API (when key present) and Claude CLI headless (dev fallback, no key on this machine). Eval harness is plain TypeScript run by `tsx`, persisting to `eval_runs`.

**Tech Stack:** TypeScript (strict), tsx, pg, embedded-postgres, @anthropic-ai/sdk, Supabase CLI migration layout.

## Global Constraints (from PRD + CLAUDE.md, verbatim where load-bearing)

1. `ai_calls.model` CHECK allows exactly `('claude-haiku-4-5', 'claude-sonnet-4-6')`. Fable and Mythos strings physically cannot be inserted.
2. Scores are append-only: no UPDATE, no DELETE, enforced at the database, corrections via `supersedes_score_id`.
3. Session state machine has no path from `created` to `capturing` that does not pass through `consented`, and `consented` requires a consent record. Enforced by trigger so it binds every caller including service role.
4. Org-scoped tables carry `org_id` under RLS; public visibility is explicit, never default.
5. Eval 8.2 threshold: recall 1.0 on the illegal class (no illegal question labeled safe); flagged-class precision reported.
6. Seed bank: 300 to 500 questions across 8 to 10 role families, every one through the compliance classifier before `passed`.
7. No UI surfaces in this goal.
8. No Co-Authored-By line in any commit message.
9. No em-dashes in any authored content.

---

### Task 1: Repo scaffold
- [x] git init, `.gitignore`, `package.json` (type module, scripts), `tsconfig.json` (strict), `.env.example`
- [x] Install deps: typescript, tsx, @types/node, pg, @types/pg, embedded-postgres, @anthropic-ai/sdk
- [x] Commit: `chore: scaffold Argo repo for Goal 1 backbone`

### Task 2: Local database harness
- [x] `db/shim.sql`: roles (anon, authenticated, service_role), `auth` schema, minimal `auth.users`, `auth.uid()` reading `request.jwt.claims`, matching what hosted Supabase provides
- [x] `scripts/db-fresh.ts`: boot embedded Postgres from zero, apply shim, apply all `supabase/migrations/*.sql` in order, report
- [x] Verify: `npm run db:fresh` completes clean on empty migrations dir
- [x] Commit

### Task 3: Schema migrations (24 tables, PRD Section 6)
- [x] `0001_core_identity.sql`: orgs, users (+ auth.users trigger), org_members, profiles
- [x] `0002_qstacks_questions.sql`: questions (+ role_family, level columns, log as decision), qstacks, qstack_items, kanban_columns, qstack_positions
- [x] `0003_interviews.sql`: interviews, interview_sessions, consents, responses, scores, mentions
- [x] `0004_briefs_sharing.sql`: briefs, brief_shares, invites, notifications
- [x] `0005_social_marketplace.sql`: posts (280 check), follows, stars, marketplace_listings
- [x] `0006_ai_calls_eval_runs.sql`: ai_calls with model CHECK allowlist, eval_runs
- [x] Verify: `npm run db:fresh` runs all migrations clean
- [x] Commit

### Task 4: RLS, grants, and state-machine triggers
- [x] `0007_rls_policies.sql`: enable RLS everywhere; org-membership policies; public visibility explicit; questions surfacing rule (flagged never surfaces except to author); ai_calls/eval_runs locked to service role
- [x] `0008_triggers.sql`: interview_sessions state machine (created→consented→capturing→ended, consent record required), scores append-only enforcement (block UPDATE/DELETE for all roles), star count cache maintenance
- [x] Verify: fresh run clean
- [x] Commit

### Task 5: Database verification suites (write, run, green)
- [x] `evals/suites/rls-probe.ts`: two users, two orgs, seeded rows in every org-scoped table; each user reads as `authenticated` with their JWT claims; assert zero cross-org rows visible, across every org_id table and the chained interview tables
- [x] `evals/suites/model-allowlist.ts`: INSERT `claude-fable-5` and `claude-mythos-5` into ai_calls must fail; allowlisted strings succeed
- [x] Both persist results to eval_runs (suites `rls_probe`, `model_allowlist`)
- [x] Run: both green. Commit

### Task 6: Model registry and transports
- [x] Read claude-api skill before writing transport code
- [x] `src/lib/models.ts`: allowlist constant mirroring the DB constraint; purpose→model routing table from PRD 4.4
- [x] `src/lib/transports/anthropic-api.ts` (requires key), `src/lib/transports/claude-cli.ts` (headless `claude -p`, JSON output)
- [x] `src/lib/registry.ts`: single entry point; throws on non-allowlisted model before any transport; logs every call to ai_calls via `src/lib/ai-log.ts`
- [x] Verify: registry rejects `claude-fable-5` in-process; a real Haiku call round-trips through the CLI transport
- [x] Commit

### Task 7: Compliance classifier (production call shape)
- [x] `src/lib/compliance-classifier.ts`: one question per call, Haiku, returns `{classification: safe|risky|illegal, reason}`; mapping safe→passed, risky/illegal→flagged with reason stored
- [x] Taxonomy in prompt: age, family status, national origin, disability, religion, plus adjacent proxies (PRD 8.2)
- [x] Verify: 3 spot calls (one obviously safe, one risky, one illegal) classify correctly
- [x] Commit

### Task 8: Eval suite 8.2, compliance screening
- [x] `evals/fixtures/compliance-labeled.json`: ~60 labeled items (safe/risky/illegal) spanning the protected classes and proxies
- [x] `evals/suites/compliance.ts`: run classifier over fixtures (concurrency-limited), compute illegal recall (threshold 1.0) and flagged precision, persist to eval_runs
- [x] Run until green; tune prompt if recall < 1.0; log tuning in build log
- [x] Commit

### Task 9: Eval suite 8.5, consent enforcement
- [x] `evals/suites/consent.ts`: attempt created→capturing directly as authenticated user (RLS path) and as service role (API path); both must fail; the legitimate consented path must succeed; persist to eval_runs
- [x] Run: green. Commit

### Task 10: Seed bank (300 to 500 questions, 8 to 10 role families)
- [x] `seed/questions/*.json`: 10 role families, ~36 questions each, authored with text, category (motivation/culture/role/skill), level, rationale, honest provenance
- [x] `seed/known-flagged.json`: ~5 deliberately non-compliant items to prove the flag path stores and isolates correctly
- [x] `seed/seed.ts`: screen every question through the classifier (concurrency 8), insert with resulting status, log ai_calls, print per-family/status summary
- [x] Run seed; verify bank queryable with badges (screening_status + verification populated on every row)
- [x] Commit

### Task 11: Remote Supabase project (best effort)
- [x] Loaded Supabase MCP tools and listed projects: the active project belongs to another product (ada-coach-01), the other is paused with unknown contents; neither reused
- [x] Deferred new-project creation to Goal 2 (decision D-G1-12): it requires a user cost confirmation that should not be buried in an autonomous run, and local verification covers every Goal 1 done criterion

### Task 12: Build log and review
- [x] `buildlog/goal1-build-log.md` (human) + `buildlog/goal1-build-log.json` (machine): decisions table, eval results, could-not-verify section, cost breakdown from ai_calls
- [x] Update this file: mark tasks complete, add Review section
- [x] Final commit

---

## Review

All five done criteria verified on 2026-07-07:

1. Migrations run clean on a fresh database (`npm run db:fresh`, embedded Postgres 17.5, 8 migrations, repeated clean runs).
2. Two-user RLS probe green: 35/35 checks across every org_id table, the chained interview tables, private profiles, notifications, and unscreened questions; persisted to eval_runs as `rls_probe`.
3. Fable/Mythos-tier inserts into ai_calls fail: 9/9 checks, four forbidden model strings rejected with SQLSTATE 23514 as a privileged caller; the registry also rejects in-process. Persisted as `model_allowlist`.
4. Seed bank queryable with badges: 305 questions, 10 role families, 298 passed / 7 flagged / 0 pending; all 5 planted violations caught; flagged rows invisible to authenticated users.
5. Suites 8.2 and 8.5 green in eval_runs: compliance illegal-recall 1.0 with flagged precision 1.0 over 64 fixtures; consent 9/9 including privileged-path bypass attempts.

Deviations: Task 11 (remote Supabase) deferred by decision D-G1-12 rather than executed; one mid-run incident (classifier JSON refusal) fixed with a retry and resumable seeding. Judgment calls D-G1-1 through D-G1-15 and the could-not-verify list live in `buildlog/goal1-build-log.md`.
