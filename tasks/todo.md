# Argo July 10-12 Evolution Push: Plan

**July 10, 2026. Goal 2 plan archived at `tasks/goal2-todo-archive.md`.**
**Status: SCAFFOLD, awaiting Mo's direction. Fable 5 leading.**

## What this push is

A large, time-boxed evolution push with Fable 5 leading, running through
the extended access window (Fable 5 available through July 12, 2026).
The job is to map Mo's vision into Argo across several plan-mode sessions
and `/goal` pushes and passes, rather than execute a single pre-written
spec. Goals 1 and 2 (schema, then surfaces) are complete; this push is
about evolving what exists toward the product Mo actually wants, not
ticking off a fixed acceptance list.

## How this file gets filled in

1. Mo and Fable run plan-mode sessions to surface the vision, one theme
   at a time.
2. Each theme that survives planning becomes a `/goal` push with its own
   acceptance criteria, written here before code.
3. Each push follows the standing agentic-engineering guardrails
   (`docs/architecture/agentic-engineering-v0_1-2026-07-10.md`): strict
   TDD via Test-Author subagent, HTML mockups before UI decisions,
   Playwright as a stop condition, model and effort routing per step.
4. Mo reviews this file between passes and redirects.

## Themes

1. QStack visual and interaction identity. Cards on a canvas, Kanban as the
   default view, a genuine collectibles feel to the library instead of a
   plain list. Mode: Plan Mode first, not /goal, this is a judgment call on
   feel. HTML prototypes reviewed before any wiring. Reuses the existing
   KanbanBoard() and dnd-kit drag mechanic, does not rebuild it.
2. Hardening, carried from the original Goal 3 scope. Keyboard and touch
   parity on the interview surface, empty and error states to the microcopy
   standard, PDF visual check, custom SMTP before real invites, the
   could-not-verify items from both build logs, the step-9 flakiness watch
   item, marketplace owner listing creation UI decision. Mode: mostly
   /goal-ready.
3. Not yet written. Only fill this in if Theme 1's output surfaces a real
   third direction.

Parking lot (not an active theme): ShareRow/SharedBrief type asymmetry
from docs/architecture/watch-items.md. Only becomes a theme if a future
theme touches sharing or interview record contracts directly.

## Standing constraints carried from Goal 1 and 2

1. New migrations only, never edit applied ones. Schema source of truth
   is `buildlog/goal1-build-log.md`, carried forward.
2. Production AI calls stay inside the `ai_calls` CHECK allowlist (Haiku
   or Sonnet); Fable never becomes Argo's runtime model.
3. Every scoring or assessment feature keeps its audit trail and human
   override path from the first migration that touches it.
4. Consent gate before any capture; two-party-consent law, not a
   preference.
5. A permission denial means stop and report to Mo, never re-route to
   the same blocked result (blocked-means-stop rule).

## Review

_Empty until the first pass completes._
