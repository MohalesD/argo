# QA: QStackCard reads stage and deck_id (2026-07-12)

## What changed

`src/components/library/QStackCard.tsx` only. `QStackRow` gains `stage:
string` and `deck_id: string | null`, matching migrations 0013 and 0014
exactly. Both card variants (`row`, `stack`) render a `StagePill` when
`stage` is non-empty and a `DeckBadge` when `deck_id` is set. No query
changes: both callers (`app/(app)/library/page.tsx`,
`app/profiles/[handle]/page.tsx`) already `select('*')` on `qstacks`, so
both columns were already arriving at runtime, just untyped and
unrendered.

## Logic in one sentence

Two new optional-looking-but-required fields on an existing row type,
rendered as two small conditional pills using the app's existing chip
visual language, with no new data fetching.

## Quiz

**Q: If a QDeck is deleted, migration 0014's `on delete set null`
nulls the member stack's `deck_id`. Does the badge disappear on its
own, or does something need to invalidate cached state?**

A: It disappears on its own. `DeckBadge` renders purely off the live
`deck_id` value passed in on each render; there is no cached or derived
state inside `QStackCard` itself. The next fetch from either caller's
`load()` reflects the null and the badge stops rendering. Pass.

## Verification evidence (this session)

- `npm run type-check`: clean (tsc --noEmit + tsconfig.scripts.json)
- `npm run eval:rls`: GREEN (all cross-org and positive-control checks)
- `npx tsx evals/suites/schema-qdeck-canvas.ts`: GREEN (asserts
  qstacks.stage and qstacks.deck_id shape directly, among others)
- `npm run eval:allowlist`: GREEN
- `npm run eval:compliance`: GREEN
- `npm run eval:consent`: GREEN
- `npm run eval:brief`: GREEN
- `npm run eval:retrieval`: RED, pre-existing, unrelated (interview
  question corpus matching; no code path through this component)
- `npm run eval:anon`: errors on missing seed data (`npm run seed`
  prerequisite not run this session); unrelated to this change

Not verified: actual browser rendering of the new pills against real
stage/deck_id data (Mo scoped this session's verification to the local
gate, not a browser check).

## Known limitations, by design

The deck-membership badge renders a decked stack as a standalone loose
card. This has no precedent in the approved prototype or in
`docs/argo-qstack-design-decisions-v1_0-2026-07-12.md`, which instead
absorbs a decked stack into its QDeck's own aggregate card. Confirmed
directly: the decisions doc does not state the exclusion as a rule in
its own prose; it is an inference from the prototype's implementation
(a Board-view-specific comment plus the shelf-grouping logic for
List/Stack views). Shipped as a pragmatic interim state per Mo's
explicit call, logged as backlog item 9 in `tasks/todo.md` for a
dedicated future pass (QDeck aggregate-card component, filtering decked
stacks out of top-level views, the deck page itself).

The stage pill uses one neutral dot+pill treatment for any stage value
rather than per-value coloring, since migration 0013 makes stage
org-defined free text with no fixed vocabulary; the approved prototype's
five-color `STAGE_CLASSES` lookup assumes a fixed five-value enum that
does not exist in the real schema.
