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
- [ ] git init, `.gitignore`, `package.json` (type module, scripts), `tsconfig.json` (strict), `.env.example`
- [ ] Install deps: typescript, tsx, @types/node, pg, @types/pg, embedded-postgres, @anthropic-ai/sdk
- [ ] Commit: `chore: scaffold Argo repo for Goal 1 backbone`

### Task 2: Local database harness
- [ ] `db/shim.sql`: roles (anon, authenticated, service_role), `auth` schema, minimal `auth.users`, `auth.uid()` reading `request.jwt.claims`, matching what hosted Supabase provides
- [ ] `scripts/db-fresh.ts`: boot embedded Postgres from zero, apply shim, apply all `supabase/migrations/*.sql` in order, report
- [ ] Verify: `npm run db:fresh` completes clean on empty migrations dir
- [ ] Commit

### Task 3: Schema migrations (24 tables, PRD Section 6)
- [ ] `0001_core_identity.sql`: orgs, users (+ auth.users trigger), org_members, profiles
- [ ] `0002_qstacks_questions.sql`: questions (+ role_family, level columns, log as decision), qstacks, qstack_items, kanban_columns, qstack_positions
- [ ] `0003_interviews.sql`: interviews, interview_sessions, consents, responses, scores, mentions
- [ ] `0004_briefs_sharing.sql`: briefs, brief_shares, invites, notifications
- [ ] `0005_social_marketplace.sql`: posts (280 check), follows, stars, marketplace_listings
- [ ] `0006_ai_calls_eval_runs.sql`: ai_calls with model CHECK allowlist, eval_runs
- [ ] Verify: `npm run db:fresh` runs all migrations clean
- [ ] Commit

### Task 4: RLS, grants, and state-machine triggers
- [ ] `0007_rls_policies.sql`: enable RLS everywhere; org-membership policies; public visibility explicit; questions surfacing rule (flagged never surfaces except to author); ai_calls/eval_runs locked to service role
- [ ] `0008_triggers.sql`: interview_sessions state machine (created→consented→capturing→ended, consent record required), scores append-only enforcement (block UPDATE/DELETE for all roles), star count cache maintenance
- [ ] Verify: fresh run clean
- [ ] Commit

### Task 5: Database verification suites (write, run, green)
- [ ] `evals/suites/rls-probe.ts`: two users, two orgs, seeded rows in every org-scoped table; each user reads as `authenticated` with their JWT claims; assert zero cross-org rows visible, across every org_id table and the chained interview tables
- [ ] `evals/suites/model-allowlist.ts`: INSERT `claude-fable-5` and `claude-mythos-5` into ai_calls must fail; allowlisted strings succeed
- [ ] Both persist results to eval_runs (suites `rls_probe`, `model_allowlist`)
- [ ] Run: both green. Commit

### Task 6: Model registry and transports
- [ ] Read claude-api skill before writing transport code
- [ ] `src/lib/models.ts`: allowlist constant mirroring the DB constraint; purpose→model routing table from PRD 4.4
- [ ] `src/lib/transports/anthropic-api.ts` (requires key), `src/lib/transports/claude-cli.ts` (headless `claude -p`, JSON output)
- [ ] `src/lib/registry.ts`: single entry point; throws on non-allowlisted model before any transport; logs every call to ai_calls via `src/lib/ai-log.ts`
- [ ] Verify: registry rejects `claude-fable-5` in-process; a real Haiku call round-trips through the CLI transport
- [ ] Commit

### Task 7: Compliance classifier (production call shape)
- [ ] `src/lib/compliance-classifier.ts`: one question per call, Haiku, returns `{classification: safe|risky|illegal, reason}`; mapping safe→passed, risky/illegal→flagged with reason stored
- [ ] Taxonomy in prompt: age, family status, national origin, disability, religion, plus adjacent proxies (PRD 8.2)
- [ ] Verify: 3 spot calls (one obviously safe, one risky, one illegal) classify correctly
- [ ] Commit

### Task 8: Eval suite 8.2, compliance screening
- [ ] `evals/fixtures/compliance-labeled.json`: ~60 labeled items (safe/risky/illegal) spanning the protected classes and proxies
- [ ] `evals/suites/compliance.ts`: run classifier over fixtures (concurrency-limited), compute illegal recall (threshold 1.0) and flagged precision, persist to eval_runs
- [ ] Run until green; tune prompt if recall < 1.0; log tuning in build log
- [ ] Commit

### Task 9: Eval suite 8.5, consent enforcement
- [ ] `evals/suites/consent.ts`: attempt created→capturing directly as authenticated user (RLS path) and as service role (API path); both must fail; the legitimate consented path must succeed; persist to eval_runs
- [ ] Run: green. Commit

### Task 10: Seed bank (300 to 500 questions, 8 to 10 role families)
- [ ] `seed/questions/*.json`: 10 role families, ~36 questions each, authored with text, category (motivation/culture/role/skill), level, rationale, honest provenance
- [ ] `seed/known-flagged.json`: ~5 deliberately non-compliant items to prove the flag path stores and isolates correctly
- [ ] `seed/seed.ts`: screen every question through the classifier (concurrency 8), insert with resulting status, log ai_calls, print per-family/status summary
- [ ] Run seed; verify bank queryable with badges (screening_status + verification populated on every row)
- [ ] Commit

### Task 11: Remote Supabase project (best effort)
- [ ] Load Supabase MCP tools; list orgs/projects; create or reuse a project; apply migrations; note magic-link auth config
- [ ] If blocked (cost confirmation, auth), log in could-not-verify and continue; local verification already covers the done criteria

### Task 12: Build log and review
- [ ] `buildlog/goal1-build-log.md` (human) + `buildlog/goal1-build-log.json` (machine): decisions table, eval results, could-not-verify section, cost breakdown from ai_calls
- [ ] Update this file: mark tasks complete, add Review section
- [ ] Final commit

---

## Review

(To be written when the work is done. Nothing here is claimable yet.)
