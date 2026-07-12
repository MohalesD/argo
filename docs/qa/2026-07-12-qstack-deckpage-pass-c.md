# QA note: QDeck page and real canvas, Fleece Ledger Pass C

Date: 2026-07-12
Task: qstack-deckpage-pass-c

## What changed

1. New `prototypes/qstack-library/06-fleece-ledger-deckpage.html`: Pass B (05) carried forward untouched, reworked per the founder's core correction, split "see everything and manage it" (a real deck page) from "get a satisfying physical glimpse" (a canvas-only hover gesture that never navigates), replaced the fixed 900px clipped canvas with a genuinely large scrollable one, and fixed three named bugs.
2. `prototypes/qstack-library/index.html`: 06 added as the lead entry; 05 and 04 stay linked, progressively dimmed to reflect they're superseded.
3. This QA note plus one CHECKLIST.md line.

`05-fleece-ledger-decks.html` was read-only for this pass, never edited: confirmed by md5 (52079494a8dfcc702655abce72af164c) matching its state before this pass began. No files under `src/`, `app/`, or project config were touched.

## Logic in one sentence

Pass B's unfurl panel tried to be both navigation and preview at once and satisfied neither well; Pass C makes a deck's title always open a real page for managing it (identity, stage pipeline, full member cards, reorder, remove, add) while the canvas alone gets a non-navigating hover-and-keyboard peek that fans two member cards into a real arc, and the reorder-and-remove controls are scoped by a stack's own deck membership rather than by which screen happens to be showing it, so the same logic serves the dedicated page and an expanded List row without duplication.

## Quiz

Question: the drag-dead-space fix and the title-click-navigates behavior sit in direct tension on canvas, since a deck's title is both a draggable card surface and a real button. What exact mechanism resolves that tension, and what would have broken if only half of it had been fixed?

Answer: the pointerdown exclusion selector originally used the blanket tag `button`, which matched `.title-btn` and silently killed drag-start from the title text on every deck and every canvas stack; the builder's first fix enumerated the real controls by class instead, restoring drag-from-title, but this alone broke the opposite direction, because `card.setPointerCapture()` was still being taken immediately at pointerdown, which retargets the browser's synthesized `click` event to the card itself, so a clean tap on the title stopped resolving to `.title-btn` and silently failed to navigate. The complete fix defers `setPointerCapture` until real movement crosses the existing 3px threshold, so a stationary tap never captures the pointer and the native click still resolves to the title button, while an actual drag still captures cleanly once movement is detected. Verified live, both directions, with real `PointerEvent` sequences: a stationary pointerdown/pointerup pair on the title navigated to the deck page, and a pointerdown followed by 90px of movement moved the card and did not navigate. Shipping only the first half would have fixed the reported symptom while silently breaking every deck's primary navigation path, arguably worse than the original bug. Quiz: PASS.

## Verification evidence (this session, all against live browser tool results)

1. Static audits: zero em/en-dashes, zero "Verified" (the builder's own account describes catching and fixing one in-flight instance, confirmed absent in the final file), token-only palette, `node --check` passes, zero console errors.
2. Drag-versus-click on the title, both directions, confirmed with real `PointerEvent` sequences (see Quiz).
3. Drag from the metadata stub (a non-title, non-control area) confirmed still works, ruling out the fix being narrowly scoped to only the title case.
4. Canvas peek: hovering a deck card set `.peeking` and revealed exactly the first two members' stage pills (Growth PM Loop showed "phone screen" and "technical screen," matching `stack_ids[0]` and `[1]` precisely); `pointerleave` cleared it; a card-level Enter (not the nested title button) toggled it; moving focus to the nested title-btn (still contained within the card) left it open, moving focus fully outside the card closed it, confirming the `relatedTarget`-based focusout logic the builder described rather than the naive `document.activeElement` check the spec's own draft language suggested.
5. Screenshot confirms a genuine arc spread (asymmetric rotation, partial stage-pill text visibly peeking from behind the front face), not a simple diagonal cascade.
6. QDeck page: navigating in from Stack showed a correct three-stage pipeline in sequence (not deduplicated) and three full member cards in `stack_ids` order; "Back to library" correctly returned to the originating view (canvas), not a hardcoded default.
7. Reorder within a deck: Arrange menu on a deck page member card showed all five options including the new "Remove from deck," Move down correctly swapped two members' order.
8. Remove from deck, both contexts: on the dedicated deck page, removing a middle member left the other two and stayed on the page with a working Undo pill; removing the two remaining members one at a time correctly deleted the deck on the final removal and navigated back to the prior view (Stack), confirmed the deck's title no longer appears among the remaining four and all three former members are genuinely loose. On an expanded List row (a different deck), the identical last-member-removal sequence correctly deleted the deck but left the view on List with no navigation, confirming the context-differentiated behavior specified: navigate back only when the removal happened on that deck's own page.
9. List view collapse: chevron toggle confirmed distinct from the title (title still navigates); default state collapsed; expanding correctly inserted three real, indented member rows as flat `.sheet` siblings; the deck row's background tint measured as the intended `--board-bg` token value (cross-checked the computed color against the token's own `color-mix` formula).
10. Pin fix: a genuinely fresh (post-reload, cleared storage) unpinned button measured white background with a light `ink-soft` border; after toggling, the same button measured a solid `ink` background and border, `aria-pressed` flipping `false` to `true`; a hover/focus tooltip returned the exact copy "Unpin this card." matching the spec. Screenshot confirms the pinned state is unmistakable against neighboring unpinned cards at a glance, not just in computed style.
11. Real canvas: content area measured 2400 by 1700 pixels against a roughly 1123 by 543 visible viewport with `overflow: auto` on the parent, confirming content genuinely exceeds the initial frame rather than nominally; no `overflow: hidden` remains in the ancestor chain.
12. Board unaffected: zero deck cards, ten loose stacks, unchanged from Pass A/B.
13. All three Direction Notes footers present (Pass A, Pass B, Pass C), confirming the builder added rather than replaced the prior two.

## Resolved design decisions (spec left room for judgment; restated in the file's own Pass C footer too)

1. Adding a stack to a deck from the dedicated deck page skips the confirm/cancel gate canvas drag requires: a drag overlap can be accidental, picking a named stack from an explicit menu on a dedicated page already is the deliberate act.
2. The canvas peek shows at most two member stage pills regardless of deck size, a representative glimpse via the two existing ghost layers; the deck page is where the full inventory lives.
3. Removing a deck's last stack deletes the deck outright, whether it was one of the five original seed decks or created fresh this session; a zero-member deck has no reason to persist either way, generalizing Pass B's freshly-created-only cleanup rule.
4. Reorder and remove-from-deck are scoped by the stack's own membership (`!isLoose(id)`), not by `state.view`, so the identical logic and controls serve the dedicated deck page and an expanded List row without duplicating either.

## Known limitations, by design

1. The optional thin connecting line between member cards, explicitly optional in the spec ("skip if it fights the List row treatment"), was skipped on both the deck page and expanded List rows.
2. Attribution, fork lineage, the marketplace, the ram logo, and the deck intelligence layer remain explicitly out of scope, per the brief.
