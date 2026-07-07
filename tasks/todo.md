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
- [ ] A5. Magic-link auth config verified end to end (signup collects
      first name + email only) — auth/confirm handles token_hash and
      code paths; real-email verification pending app surfaces

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
- [ ] E1. Playwright launch-of-friends e2e spec (Test Author running)
- [x] E2. Eval 8.1 authored, verified failing, then GREEN after
      src/lib/retrieval.ts: mean P@5 0.880 local / 0.896 hosted
- [x] E3. Eval 8.3 authored, verified failing, then GREEN after
      src/lib/brief.ts: 0/204 unsupported local, 0/188 hosted
- [ ] E4. UI-path consent test (bundled with E1)
- [x] E5. Suite fixture hygiene: probe questions born flagged, suites
      green (Test Author complete)

## Phase F: Surfaces (implementation to make Phase E pass)
- [ ] F1. QStack library: list + stack views, Kanban drag/drop with undo,
      create/edit/reorder/clone with visible fork lineage
- [ ] F2. QStack standard + detail views (rationale disclosure)
- [ ] F3. Retrieval: filters + FTS + Sonnet re-rank (candidate-set ID
      validation, discard-and-log), one-line fit reasons
- [ ] F4. Live interview mode: blocking consent step wired to the schema
      gate, per-question capture, star/highlight adjacent, 1-4 anchored
      scoring + flag, @mentions with notification, Locality-First
- [ ] F5. Score history: append-only chain rendered, override = new row
- [ ] F6. Briefs: Sonnet draft with per-claim citations, ungrounded
      claims dropped, review/edit, finalize, server-side PDF export
- [ ] F7. Share dialog: tokenized link, expiry + revocation controls on
      the dialog, anon view page, interaction -> signup prompt (first
      name + email), conversion instrumented
- [ ] F8. Profiles/posts/stars/follows/notifications: private-by-default
      profile, public prompt on first public QStack, 280-char posts,
      concurrent-safe stars, publish notifications, contribution credit
- [ ] F9. Marketplace: browse by stars/recency, free clone for real,
      premium price badge + "Coming soon" (no money path)

## Phase G: Done criteria
- [ ] G1. Playwright full loop green against the local app + hosted
      Supabase
- [ ] G2. Suites 8.1 and 8.3 green in eval_runs at PRD thresholds
- [ ] G3. Hosted rls_probe + consent_8_5 green; UI-path consent green
- [ ] G4. Real Haiku + real Sonnet production API calls in ai_calls
- [ ] G5. Build log (md + json) with decisions table and could-not-verify
      section; QA note in docs/qa/
