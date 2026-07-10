# Argo Goal 2: Surfaces — Implementation Plan
**July 7, 2026. Goal 1 plan archived at `tasks/goal1-todo-archive.md`.**

**Goal:** Every PRD Section 5 surface as a real working web app on a
hosted Supabase project, eval suites 8.1 and 8.3 green, the full
launch-of-friends loop passing as a scripted Playwright run.

**Source of truth for schema:** `buildlog/goal1-build-log.md`, not the
PRD alone. Key Goal 1 facts: questions.role_family and questions.level
first-class, questions.flag_reason, create_org() definer function,
append-only scores trigger binding all callers, consent state machine
(created/consented/capturing/ended terminal), brief_shares 32-hex token
with 30-day default expiry, ai_calls CHECK allowlist.

## Phase A: Hosted Supabase (closes Goal 1 could-not-verify 1 and 6)
- [x] A1. Provision new dedicated Supabase project (cost-confirmed),
      separate from any other project in the account (ref
      rtqgisbotvxidvzphyhn, us-east-1, $10/month)
- [x] A2. Apply all 8 migrations via MCP, in order (clean)
- [x] A3. Parameterize eval-suite DB connection; hosted rls_probe 35/35
      GREEN, hosted consent_8_5 9/9 GREEN, persisted to hosted eval_runs
- [x] A4. Seed bank copied to hosted (305 rows, ids and screening
      preserved; probe-fixture pollution neutralized, see I-G2-2)
- [x] A5. Magic-link auth end to end: real form sends accepted by
      GoTrue, token-hash verification exercised across every e2e run,
      first-login bootstrap (org + profile). Real emailed-link click is
      could-not-verify item 1 (no machine-readable inbox)

## Phase B: Schema additions for Goal 2 (new migrations only, never edit
old ones)
- [x] B1. 0009: FTS (generated tsvector + GIN), notification triggers
      (mention, publish-to-followers, contribution credit)
- [x] B2. 0010: get_shared_brief + accept_share_invite definer functions
      (view rows in invites; conversion rows with accepted_user_id),
      clone_qstack atomic clone with lineage; 0011: EXECUTE grant
      hygiene per security advisors
- [x] B3. Anon-browse probe suite green local and hosted, 34/34; anon
      surface matches the marketplace design exactly (closes watched
      item 3)

## Phase C: Production API transport proof
- [x] C1. Real Haiku + real Sonnet through AnthropicApiTransport, logged
      in hosted ai_calls with cost accounting

## Phase D: Next.js app scaffold
- [x] D1. Next.js 15 + @supabase/ssr + Tailwind v4 + design tokens;
      builds clean; middleware session refresh; server pool
- [x] D2. Surface contract v1.0 written
      (docs/argo-goal2-surface-contract-v1_0-2026-07-07.md)

## Phase E: Tests first (Test Author subagents, strict TDD)
- [x] E1. Playwright launch-of-friends spec authored, verified failing,
      then GREEN (five surgical Test-Author iterations along the way)
- [x] E2. Eval 8.1 authored, verified failing, then GREEN after
      src/lib/retrieval.ts: mean P@5 0.880 local / 0.896 hosted
- [x] E3. Eval 8.3 authored, verified failing, then GREEN after
      src/lib/brief.ts: 0/204 unsupported local, 0/188 hosted
- [x] E4. UI-path consent test GREEN (no capture control in the DOM
      before the session row reaches 'capturing')
- [x] E5. Suite fixture hygiene: probe questions born flagged, suites
      green (Test Author complete)

## Phase F: Surfaces (implementation to make Phase E pass)
- [x] F1. QStack library: list + stack views, Kanban drag/drop with undo
- [x] F2. QStack standard + detail views (rationale disclosure)
- [x] F3. Retrieval: filters + FTS + Sonnet re-rank with validated ids
- [x] F4. Live interview mode: consent gate, capture, anchored scoring,
      mentions, Locality-First neighborhood
- [x] F5. Score history: append-only chain, override = new visible row
- [x] F6. Briefs: grounded claims, citations, edit/finalize, PDF export
- [x] F7. Share dialog + anon view + signup gate + conversion recording
- [x] F8. Profiles/posts/stars/follows/notifications, go-public prompt
- [x] F9. Marketplace: sort, real free clones, premium Coming soon

## Phase G: Done criteria
- [x] G1. Playwright full loop green against the local app + hosted
      Supabase (2 passed, final run 1.3m)
- [x] G2. Suites 8.1 and 8.3 green in hosted eval_runs at thresholds
- [x] G3. Hosted rls_probe + consent_8_5 green (rerun post-fixture
      change); UI-path consent green
- [x] G4. 654 real production API calls in hosted ai_calls ($1.06)
- [x] G5. Build log (md + json), QA note in docs/qa/

## Review

All Goal 2 done criteria verified on 2026-07-07. Bonus: all seven
suites green on hosted (model_allowlist and compliance_8_2 included,
8.2 twice consecutively at temperature 0). Two permission incidents on
the record (I-G2-1, I-G2-2), both resolved with the blocked-means-stop
rule now in CLAUDE.md and persistent memory. Five real defects found by
driving the loop, all fixed and re-verified; details and the
could-not-verify list live in buildlog/goal2-build-log.md.
