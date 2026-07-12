# QA note: QStack library visual identity prototypes

Date: 2026-07-11
Task: qstack-visual-directions

## What changed

1. New `prototypes/qstack-library/index.html` (chooser page).
2. New `prototypes/qstack-library/01-chart-room.html` (direction 01, navigator's chart table).
3. New `prototypes/qstack-library/02-fleece-ledger.html` (direction 02, fine-stationery collectibles).
4. New `prototypes/qstack-library/03-modern-voyage.html` (direction 03, editorial typography and motion).
5. This QA note plus one CHECKLIST.md line.

No files under `src/`, `app/`, or project config were touched. Prototypes are standalone HTML with inline CSS/JS/SVG, no dependencies, opened directly in a browser.

## Logic in one sentence

Three competing visual directions for the QStack library share one frozen contract (byte-identical dataset, card anatomy, interaction grammar, live design tokens from `app/globals.css`) so that Mo's choice compares character, not content.

## Quiz

Question: the prototypes add a fourth "Canvas" view mode that does not exist in the live app or the Goal 2 surface contract; what must hold before Canvas becomes real code, and what schema implication does it carry?

Answer: Canvas must obey the same locality contract as the board (card-local feedback within 200 ms, card-local undo, same card anatomy in the same relative positions per Locality-First rule 11, full mouse/keyboard/touch parity), and it needs a persistence home analogous to `qstack_positions`, per-user or per-org x/y coordinates that carry no rank or status semantics, so a migration and a surface-contract amendment (new testids like `view-toggle-canvas`) come first; position must stay spatial memory, never an input to any scoring or ordering. Quiz: PASS.

## Verification evidence (this session)

1. All four pages rendered in Chromium via a temporary localhost server; zero console errors after the favicon fix.
2. Interactions exercised live in 01 and 02: star increments with card-local "Starred, undo" and aria-live announcement; card-local Move menu lists the four columns; board drag reparents card with status chip update; canvas drag persists percent coordinates to localStorage and restores them after reload. Direction 03's builder ran its own equivalent browser pass; its canvas geometry re-verified here (10 cards, zero overlaps).
3. Grep audits across all prototype files: zero em-dashes and en-dashes, zero occurrences of "Verified", every hex literal within the eleven-token palette plus #ffffff.
4. Shared dataset block md5-identical across the three direction files.
5. Canvas geometry checks: zero card overlaps and zero label collisions in 01 and 02 after layout fixes (01: default positions recomposed, chart height 680 to 900; 02: canvas height 760 to 900, in-band offset 7 to 5).
6. Default view standardized to Stack in all three (01 originally opened on Canvas).

## Known limitations, by design

1. No question text anywhere; fan-out rows show category and rubric metadata only (compliance boundary for this pass).
2. Star counts and status moves are in-memory only; canvas positions are the only persisted state.
3. App-level finding surfaced, not fixed here: the live app's gold star glyph on white sits near 2.1:1 contrast; prototypes mirror it for fidelity. Flagged separately for a future accessibility pass.
