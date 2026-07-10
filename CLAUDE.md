# Argo

Greenfield build, no existing codebase. Fable 5 through July 12, 2026;
Claude Sonnet or Opus after. A large, time-boxed Fable-driven build and
polish push is happening July 10-12. Hypothesis-driven product development, JTBD
(Jobs to Be Done), validated learning takes priority over instinct-built
structure, the opposite of how Recruiter OS's own documentation history
developed.

## Decision rights

Kellan Vance is principal lead for this sprint: full vote on speed and
scope, zero vote on legal, safety, or compliance. Priya Ramaswamy and
Nadia Okonkwo hold that vote regardless of who's sprint lead, that's not
Kellan's territory. Marcus Avery leads outside this sprint (product
judgment, architecture calls). Jordan Chen on market and competitive
calls. None of these are separate agents, they're a decision-rights map,
not a multi-agent system.

## Posture

Ship forward once there's no real external user data at risk. Flag a
real risk once, in one line, then move, no repeated gating. Revisit this
explicitly once Argo has anything resembling real users.

## Standing preferences

1. No em-dashes anywhere.
2. Lists longer than four items get numbered, not bulleted.
3. Unfold acronyms on first use.
4. HTML over JSX for anything meant to be shared outside a coding
   session.
5. A document meant to replace a prior version gets a new version number
   and date; archive the old one, don't overwrite it.

## Design and interaction doctrine

Locality-First: every control lives next to the object it affects. A
scorecard, notes field, and next question live in the same visual
neighborhood as the response being scored, not one click away. Every
state change (saved, submitted, flagged) gets immediate visible
feedback, never a silent update. Full doctrine:
`docs/mohales_deis_locality_first_interaction_design_philosophy.md`.
Consult it the way a strong designer consults a design system they
respect, a starting position with real reasoning, open to override when
a specific situation calls for it, not a checklist to force-fit.

Design anchors, extrapolate the rest, do not ask for an exhaustive spec:
bright human-legible gold as primary, dark forest green as a minor
accent only, generous white and light cream, dark warm gray body text,
never pure black. Full voice and microcopy discipline:
`docs/design-and-voice-philosophy-v3_260703.md`.

## Architecture, resolved

Argo is multi-user and shared-record from day one (interviewer, hiring
manager, team). There is no prior backend. Argo is greenfield, confirmed.
The only prior code tied to Mo is a 2020 intro to programming class
exercise, his first personal project learning to code, never connected to
Argo's actual product research, and explicitly not a foundation to build
on. There is no backend to check or extend.

Stack, per the approved PRD (decision D1): Next.js (App Router)
frontend, Supabase for Postgres, auth, row-level security, and storage.
One repository, one deployment target. Playwright for end-to-end
verification. Production AI calls route only to Claude Haiku 4.5 or
Claude Sonnet 4.6, enforced by a CHECK constraint on `ai_calls.model`,
never by prompt instruction alone (decision D5); this is the mechanism
behind hard boundary 1 above.

## Repository state

No code exists yet as of this writing; the repo holds this file and
`docs/` only. There is no build, lint, or test command to run. Once Goal
1 (schema and migrations, per the PRD's Section 9) scaffolds the
repository, add real commands here rather than guessing at them.

## Hard boundaries, non-negotiable, everything else is yours to decide

1. Fable 5 and Mythos-class models never appear as Argo's production
   runtime model. Production routing (Haiku, Sonnet, or Opus per call
   type) is structurally enforced (a database constraint), not a prompt
   suggestion.
2. Any feature that scores, rates, or assesses a candidate carries an
   audit trail and a human override path in the schema, from the first
   migration.
3. Interview recording requires a consent step before capture starts,
   stored as a schema flag. Two-party-consent recording law, not a
   preference.
4. Design and build your own evals against the Workday AI-hiring
   discrimination litigation as the failure mode to avoid. Establish
   your own success criteria and log what you decided.
5. A permission denial from the auto-mode classifier means stop and
   report to Mo, never attempt a different technical path to the same
   blocked result. This happened once already during Goal 2 (an ALTER
   ROLE password change blocked, followed by a SCRAM-verifier workaround
   attempt, also blocked). If this pattern recurs, log it in the build
   log as an incident, separate from a routine credential request.

## Project files

`docs/argo-context-seed-*.md`: what's validated, assumed, and untested
in Argo's discovery history.
`docs/argo-discovery-persona-master-*.md`: personas, jobs to be done, the
2026 AI landscape.
`docs/argo-business-model-positioning-*.md`: the Argonauts narrative,
BHAG (Big Hairy Audacious Goal), business model canvas.
`docs/argo-product-development-notes-*.md`: the QStack object model,
surfaces, marketplace, intelligence layer, PLG (product-led growth) loop.
`docs/argo-prd-*.md`: the PRD. Check its status line, currently v0.1,
awaiting markup.
`docs/build-philosophy-v2-*.md`: Mo's stable cross-project preferences.

Always read the current PRD before starting build work. If a file here
conflicts with something in `docs/`, the file in `docs/` wins; this file
is the summary, not the source of truth.

## Search precedence for codebase questions

For any structural or architectural question (where does X live, what calls Y,
how does Z connect, what breaks if I change this), query graphify-out/graph.json
FIRST via /graphify query. If the graph can't answer it, use codebase-memory-mcp.
Use grep ONLY for literal string lookups the graph doesn't contain (an error
message, a config value, a specific column name). Do not grep to answer a
structural question when the graph exists.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
