# QA note: QStack card rebuild, Fleece Ledger Pass A

Date: 2026-07-11
Task: qstack-card-pass-a

## What changed

1. New `prototypes/qstack-library/04-fleece-ledger-card.html`: direction 02 transformed per Mo's Pass A decisions. 02 remains on disk unchanged as the archived bake-off version.
2. `prototypes/qstack-library/index.html`: added the 04 entry as the chosen direction.
3. This QA note plus one CHECKLIST.md line.

No files under `src/`, `app/`, or project config were touched. Pass B (canvas, decks, lineage, attribution, logo) not started.

## Logic in one sentence

The winning card fuses 03's ticket anatomy onto 02's letterpress body and splits the old OR-condition into two honest signals: the fleece edge is reversible status (in rotation) and the gold seal is durable achievement (25 stars), each duplicated in ink so gold never carries state alone.

## Quiz

Question: the seal/edge split means a card's gold treatments now derive from two independent fields (status, star count); when this card ships for real, what prevents the two signals from silently drifting out of sync with the database, and where must the 25-star threshold live?

Answer: both signals must be derived, never stored, rendered from the same `qstacks.star_count` and board-position row that the library already reads, recomputed on every star and move event (the prototype's refreshSeal/refreshEdge on state change models this); the 25-star threshold is a product constant that belongs in one shared module (not duplicated per component), and if it ever becomes tunable it moves to org settings with the seal recomputed at read time, so no migration stores "has_seal" as a column that can go stale. Quiz: PASS.

## Verification evidence (this session, all against live browser tool results)

1. Seal/edge split: moving s1 out of rotation removed the edge class live while the seal remained; undo restored the edge. Starring s3 from 18 to 25 made the seal appear live. s9 renders seal without edge (ready status). Dataset covers all four combinations.
2. Seal accessibility: role img, tabindex 0, aria-label "Seal: earned at 25 stars", tooltip content "Earned at 25 stars. It stays earned." shown via CSS on hover and focus.
3. Unified feedback pill: "Moved to Ready to run" with "Undo move" inside one pill, background computed rgb(230, 239, 233), which is the forest-soft token; card body untinted.
4. Share: "Link copied" pill, no undo, clipboard write in try/catch.
5. Arrange menu: Move up reordered s2 before s1, "Order saved" plus undo restored order, focus preserved on the moved card's caret.
6. Density: persisted to localStorage, Dense yields 164px cards (six-per-row capacity at 1280px; sample families cap at three visible), watermark and set mark hidden, chips collapsed. One violation found and fixed: caret glyphs were 9px, raised to 11px.
7. Preview overflow: on the bottom-most canvas card, opening the fan grew the canvas 900 to 1457 with the panel fully visible, "See all 4 questions" expanded to four straightened metadata rows still fully visible, Esc restored the canvas to exactly 900.
8. Off-board offset: s10's Move-to button carries computed transform translate(9px, 9px) with white background in every view.
9. Flag tokens wired: s7 renders "1 flagged" on flag-soft with ink text and title "Visible only to you, with the reason." Only red in the file.
10. Grep audits: zero em/en dashes, zero "Verified", hex values limited to the eleven tokens plus #ffffff (remaining matches are interpunct HTML entities). Zero console errors. Builder ran node --check on the extracted script.

## Decisions and deviations logged

1. The carried-over shine stays single-hue gold, not holographic rainbow; the rainbow ban from the bake-off spec stands unless Mo overrides in review.
2. Flag tokens were wired (not removed) in 04 only, to their real product meaning (author-visible flagged-question count); archived prototypes 01 to 03 left untouched per the versioning preference.
3. Arrange on board cards reorders within the column (builder extension so the shared anatomy carries no dead control).
4. Known cosmetic nit, not fixed: at Dense, the arrange caret can wrap below a two-line title on 164px cards.
