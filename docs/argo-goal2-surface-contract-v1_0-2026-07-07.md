# Argo Goal 2 Surface Contract v1.0
**July 7, 2026. The route map and test-hook contract both the Playwright
suite and the implementation are written against. If implementation
needs to deviate, this file gets a new version and the tests change with
it, never silently.**

## Stack facts

1. Next.js 15 App Router, TypeScript, Tailwind v4.
2. Supabase auth (magic link) via @supabase/ssr; the browser client
   talks straight to Postgres under RLS for user-scoped CRUD.
3. Server route handlers exist only where the service role key or an AI
   call is required (re-rank, brief generation, question screening,
   PDF, share acceptance).
4. Anonymous tokenized brief access goes through security-definer RPC
   `get_shared_brief(p_token)`, never a direct table read.
5. Design tokens (PRD Section 7): gold #E3A81C (hover #C9971A), white
   #FFFFFF, cream #FBF6E9, body #2B2A26, secondary #55524A, forest
   green #2E4A3A accent, warm red for flag/destructive. Serif headings
   (Source Serif 4), sans body (Inter).

## Environment contract

App reads (from `.env.local`):
1. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: hosted
   project client config.
2. `SUPABASE_SECRET_KEY`: service role, server-only.
3. `DATABASE_URL_HOSTED`: direct pg for ai_calls logging and evals.
4. `ANTHROPIC_API_KEY`: production transport.

Playwright authenticates test users via
`supabase.auth.admin.generateLink({ type: 'magiclink' })` with the
service key, then visits `/auth/confirm?token_hash=...&type=email`,
because the built-in mailer is rate-limited. Human users go through the
real emailed link; both paths hit the same confirm route.

## Routes

| Route | Surface |
| --- | --- |
| `/` | Redirect: authed -> /library, anon -> /signin |
| `/signin` | Magic-link form: first name + email only |
| `/auth/confirm` | Route handler: verifies token_hash, establishes session, redirects (honors `?next=`) |
| `/library` | QStack library: list view, stack view, Kanban board |
| `/qstacks/new` | Create QStack |
| `/qstacks/[id]` | QStack standard view + per-question detail disclosure, edit, reorder, clone |
| `/bank` | Question bank retrieval: filters + search + re-rank |
| `/interviews` | Interview list + create |
| `/interviews/[id]` | Interview record: sessions, score history, brief entry point |
| `/live/[sessionId]` | Live interview mode (consent gate then capture) |
| `/briefs/[id]` | Brief review/edit/finalize + share dialog |
| `/api/briefs/[id]/pdf` | Server-side PDF of the same brief |
| `/share/[token]` | Anonymous brief view + interaction signup gate |
| `/market` | Marketplace browse (stars/recency sort, Get buttons) |
| `/profiles/[handle]` | Public profile: posts, public QStacks, follow |
| `/me` | Own profile settings, visibility toggle, posts composer |

API route handlers: `POST /api/rerank`, `POST /api/briefs` (generate),
`POST /api/questions` (create + screen contributed question),
`POST /api/share/[token]/accept` (records invite conversion after
signup), `GET /api/briefs/[id]/pdf`.

## data-testid contract

Static ids; row-scoped elements embed the entity title/name in
`aria-label` so tests select by accessible name within the testid scope.

### Auth
1. `signin-first-name`, `signin-email`, `signin-submit`, `signin-sent`
   (confirmation state after send).

### Library
2. `view-toggle-list`, `view-toggle-stack`, `view-toggle-board`.
3. `qstack-card` (one per QStack in any view; accessible name = title).
4. `new-qstack`, `qstack-title-input`, `qstack-save`.
5. `kanban-column` (accessible name = column name), `kanban-add-column`.
6. `kanban-undo` (local undo affordance on the moved card's column).

### QStack view
7. `qstack-question-row` (per question; name = question text prefix).
8. `question-detail-toggle` (rationale disclosure, per row).
9. `screening-badge` (per question: "Screened" or flag state).
10. `clone-qstack`, `fork-lineage` (visible lineage line on clones).
11. `add-question`, `question-text-input`, `question-save`.
12. `reorder-handle` (per row; keyboard operable).
13. `qstack-visibility` (private/org/public control).

### Bank / retrieval
14. `bank-search-input`, `bank-filter-family`, `bank-filter-level`,
    `bank-filter-category`, `bank-search-submit`.
15. `bank-result` (per question result), `rerank-button`,
    `rerank-reason` (one-line fit explanation, per re-ranked result).
16. `bank-add-to-qstack` (per result).

### Interviews
17. `new-interview`, `interview-candidate-name`, `interview-qstack`,
    `interview-save`, `interview-row`.
18. `start-session` (creates session in `created`, routes to live).

### Live interview (Locality-First hard requirement)
19. Consent gate: `consent-panel`, `consent-party-interviewer`,
    `consent-party-candidate`, `consent-confirm`. No capture control
    renders until the session row is in state `capturing`.
20. `live-question` (active question text), `response-field`,
    `response-saved` (visible save state at the field).
21. `star-response`, `highlight-response` (adjacent to response field).
22. `score-anchor-1` .. `score-anchor-4` (behaviorally anchored,
    adjacent to the response), `score-flag`, `score-saved`.
23. `next-question`, `prev-question`, `end-session`.
24. `mention-input`, `mention-submit` (on the response), notification
    lands with deep link to `/live/[sessionId]?response=<id>` or the
    interview page focused on that response.

### Score history and override
25. `score-history` (per response: full chain, oldest to newest),
    `score-history-entry` (shows value, scorer, superseded state),
    `override-score` (opens new-row correction; never edits).

### Briefs
26. `generate-brief`, `brief-section` (role context, per-category,
    starred moments, open questions), `brief-claim` (per claim),
    `brief-citation` (expandable, resolves to response text),
    `brief-edit`, `brief-save-edit`, `finalize-brief`, `export-pdf`.

### Share dialog (controls live on the dialog, next to the link)
27. `share-brief` (opens dialog), `share-link` (the URL, copyable),
    `share-copy`, `share-expiry` (shows/adjusts expiry),
    `share-revoke`.

### Share view (anon)
28. `shared-brief-view`, `share-interact` (any interaction control for
    anon viewer), `share-signup-first-name`, `share-signup-email`,
    `share-signup-submit`, `share-dead-end` (revoked/expired page,
    no brief content).

### Social
29. `star-button` (on qstack cards/pages; reflects count),
    `star-count`, `follow-button`, `post-input`, `post-submit`,
    `post-item`, `profile-visibility-toggle`,
    `go-public-prompt` (shown on first public QStack).
30. `notifications-button` (with unread count), `notification-item`
    (deep links per type).

### Marketplace
31. `market-sort-stars`, `market-sort-recent`, `market-card`,
    `price-badge`, `get-button` (free: clones for real; premium:
    disabled "Coming soon", moves no money).

## Behavioral guarantees the tests may rely on

1. Consent: `/live/[sessionId]` renders the consent panel for state
   `created`; the response field and scoring controls do not exist in
   the DOM until state is `capturing`. The only UI path to capture is
   `consent-confirm`, which stores consent rows then advances state
   through `consented` to `capturing` via the schema state machine. No
   secondary UI-side gate exists to weaken or duplicate it.
2. Overrides insert a new score row with `supersedes_score_id`; history
   renders every row; the current score is the latest non-superseded.
3. Re-rank returns only IDs from the candidate set; anything else is
   discarded and logged server-side; flagged/pending questions never
   appear in `bank-result` items.
4. Brief claims each carry at least one citation that resolves to a real
   response; ungrounded claims are dropped before the draft is stored.
5. Share links: 30-day default expiry shown on the dialog; revoke takes
   effect immediately; revoked/expired tokens render `share-dead-end`
   with zero brief content.
6. Stars: one per user per QStack, count correct under concurrency.
7. Every mutation shows visible local feedback within 200 ms
   (optimistic) and reconciles on save.
