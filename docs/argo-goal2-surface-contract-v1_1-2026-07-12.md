# Argo Goal 2 Surface Contract v1.1
**July 12, 2026. Supersedes v1.0 (July 7, 2026), which stays archived at
`docs/argo-goal2-surface-contract-v1_0-2026-07-07.md`. The route map and
test-hook contract both the Playwright suite and the implementation are
written against. If implementation needs to deviate, this file gets a new
version and the tests change with it, never silently.**

**What v1.1 adds:** Canvas as a legitimate fourth library surface, QDeck
as a first-class entity, the stage field, and three new behavioral
guarantees (canvas spatial memory, loose-stack positioning, deck
copy-not-reference). Everything from v1.0 carries forward unchanged
unless marked.

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
| `/library` | QStack library: list view, stack view, Kanban board, **canvas (v1.1)** |
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
2. `view-toggle-list`, `view-toggle-stack`, `view-toggle-board`,
   `view-toggle-canvas` **(v1.1: canvas is a peer of the other three,
   same toggle group, same relative position)**.
3. `qstack-card` (one per QStack in any view; accessible name = title).
4. `new-qstack`, `qstack-title-input`, `qstack-save`.
5. `kanban-column` (accessible name = column name), `kanban-add-column`.
6. `kanban-undo` (local undo affordance on the moved card's column).

### Canvas (v1.1, Locality-First hard requirement)
7. `canvas-surface` (the pannable spatial field).
8. Positioned stacks reuse `qstack-card`; positioned decks are
   `qdeck-card` (accessible name = deck title).
9. `canvas-position-saved` (visible save state rendered AT the moved
   object, within the standing 200 ms optimistic budget; never a
   silent update, never a distant toast-only confirmation).
10. `canvas-undo` (local undo on the moved object, mirroring
    `kanban-undo`).
11. `new-qdeck`, `qdeck-title-input`, `qdeck-save`.
12. `add-to-deck` (on the stack; when the stack already lives in
    another deck the control and its microcopy present the action as
    making a copy, never as moving a shared reference).
13. `remove-from-deck` (on the stack, inside its deck; makes it loose,
    never deletes it).
14. Input parity is part of the contract, not polish: every canvas
    move works by mouse drag, by keyboard (focusable, arrow-key
    operable, same pattern as `reorder-handle`), and by touch, per the
    PRD 5.2 acceptance bar.

### QStack view
15. `qstack-question-row` (per question; name = question text prefix).
16. `question-detail-toggle` (rationale disclosure, per row).
17. `screening-badge` (per question: "Screened" or flag state).
18. `clone-qstack`, `fork-lineage` (visible lineage line on clones).
19. `add-question`, `question-text-input`, `question-save`.
20. `reorder-handle` (per row; keyboard operable).
21. `qstack-visibility` (private/org/public control).
22. `qstack-stage` **(v1.1: stage is a real editable field on the
    stack, org-defined free text; it is never parsed from, embedded
    in, or displayed as part of the title)**.

### Bank / retrieval
23. `bank-search-input`, `bank-filter-family`, `bank-filter-level`,
    `bank-filter-category`, `bank-search-submit`.
24. `bank-result` (per question result), `rerank-button`,
    `rerank-reason` (one-line fit explanation, per re-ranked result).
25. `bank-add-to-qstack` (per result).

### Interviews
26. `new-interview`, `interview-candidate-name`, `interview-qstack`,
    `interview-save`, `interview-row`.
27. `start-session` (creates session in `created`, routes to live).

### Live interview (Locality-First hard requirement)
28. Consent gate: `consent-panel`, `consent-party-interviewer`,
    `consent-party-candidate`, `consent-confirm`. No capture control
    renders until the session row is in state `capturing`.
29. `live-question` (active question text), `response-field`,
    `response-saved` (visible save state at the field).
30. `star-response`, `highlight-response` (adjacent to response field).
31. `score-anchor-1` .. `score-anchor-4` (behaviorally anchored,
    adjacent to the response), `score-flag`, `score-saved`.
32. `next-question`, `prev-question`, `end-session`.
33. `mention-input`, `mention-submit` (on the response), notification
    lands with deep link to `/live/[sessionId]?response=<id>` or the
    interview page focused on that response.

### Score history and override
34. `score-history` (per response: full chain, oldest to newest),
    `score-history-entry` (shows value, scorer, superseded state),
    `override-score` (opens new-row correction; never edits).

### Briefs
35. `generate-brief`, `brief-section` (role context, per-category,
    starred moments, open questions), `brief-claim` (per claim),
    `brief-citation` (expandable, resolves to response text),
    `brief-edit`, `brief-save-edit`, `finalize-brief`, `export-pdf`.

### Share dialog (controls live on the dialog, next to the link)
36. `share-brief` (opens dialog), `share-link` (the URL, copyable),
    `share-copy`, `share-expiry` (shows/adjusts expiry),
    `share-revoke`.

### Share view (anon)
37. `shared-brief-view`, `share-interact` (any interaction control for
    anon viewer), `share-signup-first-name`, `share-signup-email`,
    `share-signup-submit`, `share-dead-end` (revoked/expired page,
    no brief content).

### Social
38. `star-button` (on qstack cards/pages; reflects count),
    `star-count`, `follow-button`, `post-input`, `post-submit`,
    `post-item`, `profile-visibility-toggle`,
    `go-public-prompt` (shown on first public QStack).
39. `notifications-button` (with unread count), `notification-item`
    (deep links per type).

### Marketplace
40. `market-sort-stars`, `market-sort-recent`, `market-card`,
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
6. Stars: one per user per QStack, enforced by a database unique
   constraint, count correct under concurrency.
7. Every mutation shows visible local feedback within 200 ms
   (optimistic) and reconciles on save.
8. **(v1.1)** Canvas position is spatial memory only, permanently. It
   never feeds ordering, ranking, sorting, or any scored or assessed
   output. Tests may assert that list, stack, board, bank, and
   marketplace orderings are identical before and after any canvas
   rearrangement.
9. **(v1.1)** Removing a stack from a deck makes it loose, never
   deletes it, and it surfaces on the canvas at its own remembered
   position (deck membership never deletes or alters a position row)
   or, when it has none, at a position seeded near the deck it left.
   It never lands silently at the canvas origin on top of other
   objects.
10. **(v1.1)** Adding a stack that already lives in another deck
    visibly creates a copy through the existing clone path, never a
    shared reference; a stack belongs to at most one deck.
