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
- [ ] A1. Provision new dedicated Supabase project (cost-confirmed),
      separate from any other project in the account
- [ ] A2. Apply all 8 migrations via MCP, in order
- [ ] A3. Parameterize eval-suite DB connection (DATABASE_URL override in
      src/lib/db.ts), rerun rls_probe and consent_8_5 against hosted,
      results persisted to hosted eval_runs
- [ ] A4. Copy the screened seed bank from local embedded PG to hosted
      (screening results are data; do not re-spend the screening run)
- [ ] A5. Magic-link auth config verified end to end (signup collects
      first name + email only)

## Phase B: Schema additions for Goal 2 (new migrations only, never edit
old ones)
- [ ] B1. 0009: FTS index on questions (text + rationale), notification
      triggers (mention -> notify, publish -> notify followers,
      question accepted -> contribution credit), invites view/conversion
      instrumentation columns if needed
- [ ] B2. 0010: definer functions for anonymous tokenized brief access
      (get_shared_brief(token), record_share_view, accept_share_invite),
      never a plain RLS path; clone_qstack() atomic clone with lineage
- [ ] B3. Anon-browse probe suite: marketplace surface reads exactly what
      anon RLS allows (public qstacks, passed questions, public profiles,
      listings), nothing more (closes watched item 3)

## Phase C: Production API transport proof
- [ ] C1. One real Haiku call + one real Sonnet call through
      AnthropicApiTransport, logged in hosted ai_calls

## Phase D: Next.js app scaffold
- [ ] D1. Next.js App Router + @supabase/ssr auth (magic link), Tailwind,
      design tokens from PRD Section 7 (gold #E3A81C, cream #FBF6E9,
      warm gray #2B2A26, forest green #2E4A3A accent)
- [ ] D2. Route/surface contract doc (routes, key testids) so tests and
      implementation agree before either is written

## Phase E: Tests first (Test Author subagents, strict TDD)
- [ ] E1. Playwright launch-of-friends e2e spec (signup, clone, interview
      with consent, score with override, brief with citations, share,
      second account via link, star, follow) written by Test Author,
      failing for valid reasons
- [ ] E2. Eval 8.1 retrieval suite + 25 fixtures (P@5 >= 0.6, zero
      flagged/pending in results) by Test Author
- [ ] E3. Eval 8.3 brief faithfulness suite + 15 synthetic transcripts
      (zero unsupported claims, citations resolve) by Test Author
- [ ] E4. UI-path consent test (Playwright: no route to capture without
      consent step) by Test Author

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
