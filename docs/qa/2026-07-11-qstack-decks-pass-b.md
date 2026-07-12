# QA note: QDeck and canvas rework, Fleece Ledger Pass B

Date: 2026-07-11
Task: qstack-decks-pass-b

## What changed

1. New `prototypes/qstack-library/05-fleece-ledger-decks.html`: the approved Pass A card (04) carried forward untouched, extended with QDeck as a first-class object across List, Stack gallery, and Canvas, plus a reworked canvas (grow-not-clip, alignment hairlines, pinning).
2. `prototypes/qstack-library/index.html`: 05 added as the lead entry; 04 stays linked, dimmed to reflect it is superseded by 05 as the working base.
3. This QA note plus one CHECKLIST.md line.

`04-fleece-ledger-card.html` was read-only for this pass, never edited: confirmed by md5 (0fad2488b1db840e9551f173d5cf492f) and line count (1762) both matching its state before this pass began. No files under `src/`, `app/`, or project config were touched.

## Logic in one sentence

A QDeck is a stack of QStacks (all the interview stages for one role) modeled as its own entity with independent identity, star count, and one-to-many membership; the library now shows 15 top-level items (5 decks plus 10 loose stacks drawn from 25 total QStack records) instead of 25 loose cards, which is the concrete test of "legible at volume" the brief asked for.

## Quiz

Question: the combine-drag mechanic writes to `state.decks` and `state.positions` on confirm, and the Undo action must reverse both cleanly; what specific bug did verification find in that reversal, and what would have shipped if it had gone unverified?

Answer: `commitCombine`'s undo callback only called `removeStackFromDeck` for the dragged stack, never for the target stack, even when the target was a loose stack absorbed into a brand-new deck (as opposed to added to an already-existing deck, where only one stack ever needs reversing). Confirmed live: combining two loose stacks into a new deck, then clicking Undo, left a phantom deck with the target stack still trapped inside it and the deck count permanently off by one (5 became 6 and stayed 6). Unverified, this would have shipped a working-looking Undo that silently corrupted state on exactly the "new deck" path, the more common of the two combine outcomes. Fixed in this session: undo now also reverses the target when the combine created a fresh deck, verified by rerunning the full drag, confirm, undo sequence to a clean 5 decks and 15 top-level items both before and after. Quiz: PASS.

## Verification evidence (this session, all against live browser tool results)

1. Static audits: zero em/en-dashes, zero "Verified", zero literal question marks in rendered copy (all `?` hits are JS ternaries), token-only palette, `node --check` passes, zero console errors.
2. Dataset counts confirmed live: 25 STACKS, 5 DECKS, 15 top-level items (10 on Board, matching loose-only filtering; 15 in Stack/List/Canvas).
3. Board correctly excludes decks: `.card-board.card-deck` count is 0.
4. Deck rendering: seal appears on decks with 25+ stars (Growth PM Loop, 29 stars) with no fleece edge or shine on any deck, confirmed by class inspection and screenshot.
5. Unfurl: stage pill, status word, and star count render per member row, confirmed for a 3-member deck; List inserts inline, Stack/Canvas overlay and animate in.
6. Canvas grow-not-clip: opening the bottom-most deck's unfurl panel grew the canvas 900 to 1082px with the panel fully visible; closing it restored exactly 900px. Same mechanism now shared with the pre-existing stack fan-out (the originally reported clipping bug).
7. Alignment hairlines: dragging a card to align its left edge with a neighbor's showed the vertical guide line at the correct pixel position; the committed drop position was confirmed identical to the position already visible mid-drag (no snap-on-release), and a controlled pixel-offset test confirmed the drop lands wherever the pointer left it, not rounded to any grid or neighbor edge.
8. Pinning: toggling pin set `aria-pressed="true"` and changed the accessible name to "Unpin ...".  A pinned card's position was then confirmed unchanged after both a simulated drag and a keyboard arrow press.
9. Drag-to-combine, cancel path: armed the combine (target got `combine-target` class), clicked Cancel, confirmed deck count unchanged and the dragged card's position reverted to its exact pre-drag spot.
10. Drag-to-combine, new-deck path: confirmed "Sales Loop created" (auto-titled from the shared sales role_family), both source stacks disappeared as individual items, deck count 5 to 6, total 15 to 14. Undo bug found and fixed here (see Quiz); reverified clean afterward.
11. Drag-to-combine, existing-deck path: dragging a loose stack onto Growth PM Loop produced "Added to Growth PM Loop", deck count stayed at 5 (no new deck), total 15 to 14; Undo restored cleanly to 15 with no fix needed, this path was already correct.
12. Keyboard parity: pressing D on a focused loose canvas stack opened "Combine into QDeck" listing all 14 other top-level items; selecting one reached the identical confirmation popover as the drag path (shared commit code, not a duplicate implementation); Escape canceled it with no state change.
13. Reduced-motion coverage confirmed present for the new deck-layer, member-row, and unfurl-panel-exit animations (split across two `@media` blocks in the file, a minor cosmetic redundancy, not a functional gap).

## Investigation note, not a defect

Early in this session's verification, a hand-written drag simulation appeared to combine the wrong pair of cards. Root-caused to the test harness, not the app: the simulated pointer used inconsistent grab and drop reference points (card center for one axis, an arbitrary offset for the other), which does not actually center the dragged card on the intended target. A corrected test using a consistent center-to-center transform confirmed the overlap-detection algorithm targets correctly. Recorded here so this specific false alarm is not re-investigated from scratch in a future session.

## Resolved design decisions (spec left room for judgment; stated in the file's own Pass B footer too)

1. Decks never appear on the Board: a deck spans multiple statuses, and inventing a single-status rollup for it is exactly the "deck intelligence layer" judgment the brief said not to build this pass.
2. Decks get the seal (25+ stars, independent of status) but never the fleece edge or shine (both mean "in rotation," a single-status concept a multi-stage deck does not have).
3. Unfurled member rows are informational only, no Move-to control inside the panel; the brief's explicit ask was "revealing every stack inside with its stage pill visible," a display requirement, not a request for nested full-card interactivity.
4. Drag-to-combine and its keyboard equivalent are canvas-only; Board's drag gesture already means "change status," and overloading it with "also maybe form a deck" would be genuinely ambiguous.
5. The copy-vs-move rule for stacks already in a deck exists at the data layer (`addStackToDeck`) but only the move path (loose stack into a deck) is reachable through this pass's built UI, since decked stacks are not independently draggable canvas items yet; dragging a stack out of one deck into another is not built this pass.
6. HARD CONSTRAINT preserved and re-verified: the comment above `loadPositions()` states canvas x/y are spatial memory only, never a ranking, ordering, or scoring signal, restated in the Pass B footer for a human reviewer who does not read code.

## Known limitations, by design

1. Deck titles are auto-generated only (role-family based, or "New QDeck" for a mismatched pair); renaming a deck is not built.
2. Unfurled list-view titles truncate at narrow widths in the member-row layout; legible but a cosmetic tightening candidate for a later pass.
3. Attribution, fork lineage, the marketplace, the ram logo, and the deck intelligence layer remain explicitly out of scope, per the brief.
