# Argo Agentic-Engineering Guardrails v0.1

**July 10, 2026 · Draft for Mo's review · Authored by Claude Fable 5**
**Status: DRAFT. Written to carry the process rules into the July 10-12
evolution push. Not yet ratified by Mo.**

## Why this doc exists

The July 10-12 push runs Fable across many `/goal` passes and plan-mode
sessions with long stretches of autonomy. Argo already has strong process
rules, but they split into two classes that behave very differently under
autonomy, and the difference is invisible until one silently fails. This
doc names that split, catalogs which rule is in which class, and says
what to do about the gap before it costs a bad merge.

Related: `watch-items.md` (structural findings to check before touching
code), and the search-precedence rule now enforced by the
`graphify hook-guard` PreToolUse hook in `.claude/settings.json`.

## The core distinction: enforced vs advisory

1. **Enforced rules** are mechanisms. A database CHECK constraint, a
   PreToolUse hook, an auto-mode permission classifier. They fire
   deterministically, on every relevant event, whether or not the agent
   is paying attention. They cannot be forgotten.
2. **Advisory rules** are prose in a CLAUDE.md file. They fire only when
   the agent reads them, recognizes the moment they apply, and chooses to
   act. Under a fresh context, a long session, or competing instructions,
   an advisory rule can simply not surface. Nothing errors. The work
   looks complete.

The rules Mo cares most about that got built as mechanisms fire reliably:
the `ai_calls` model allowlist (a CHECK constraint, decision D5), the
consent state machine (a schema flag before capture), and now search
precedence (a hook). The rules left as prose fire only when the agent
remembers them. During autonomy that is a coin flip, not a guarantee.

## The evidence: the quiz that did not fire

On 2026-07-10, the graphify-wiring commit went in without the "Quiz
Before Merging" ritual (write a summary to `docs/qa/<date>-<slug>.md`,
append a line to `docs/qa/CHECKLIST.md`, answer an architectural quiz
question). Mo's global CLAUDE.md requires this "before finishing a task,
committing, or proposing a merge." The commit met that trigger. The rule
still did not fire.

It did not fire because it is advisory. There is no mechanism watching
`git commit` for a matching QA file. The rule depends entirely on the
agent surfacing it at commit time, and in a session already carrying a
graphify pipeline, a memory system, and two CLAUDE.md files, it did not
get surfaced. That is the honest failure mode, and it is not specific to
this one commit. Every advisory rule has the same exposure on every pass
where the agent's attention lands elsewhere.

Whether to worry depends on the rule. A skipped quiz on a docs commit is
cheap. The same silent-miss mechanism applied to strict TDD or the
consent gate is not cheap, and those are advisory too.

## Rule catalog and classification

| Rule | Source | Class | Silent-miss risk under autonomy |
| --- | --- | --- | --- |
| Fable never the production runtime model | Project D5 | Enforced (CHECK) | None |
| Consent before capture | Project HB3 | Enforced (schema state machine) | Low |
| Scoring carries audit trail + override | Project HB2 | Enforced (schema) | Low |
| Search precedence (graph before grep) | Project | Enforced (hook, 2026-07-10) | Low |
| Blocked means stop, never re-route | Project HB5 | Advisory + memory | High, and high cost |
| Strict TDD via Test-Author subagent | Global | Advisory | High, and high cost |
| E2E assertions check real outcomes | Global | Advisory | High |
| Quiz Before Merging | Global | Advisory | Medium, low cost |
| HTML mockups before UI decisions | Global | Advisory | Medium |
| Plan First (todo.md for 3+ step work) | Global | Advisory | Medium |
| Effort and model routing per step | Global | Advisory | Medium |
| Scope discipline / Ponytail minimal code | Global | Advisory | Medium |
| No speculation (read before acting) | Global | Advisory | Medium |

## Recommendations for the push

1. **Convert the two highest-cost advisory rules to mechanisms.**
   Blocked-means-stop and strict TDD are the ones where a silent miss
   does real damage. Blocked-means-stop already has memory and the
   auto-mode classifier behind it; the remaining gap is the re-route
   attempt, which is behavioral. TDD can be partly mechanized with a
   PreToolUse hook that warns when source (non-test) files are edited
   with no failing test on record for the change.
2. **Make Quiz Before Merging a commit-time hook.** A PreToolUse hook
   matching `Bash` that inspects `git commit` invocations and blocks or
   warns when no `docs/qa/<today>-*.md` exists is straightforward with
   the same `.claude/settings.json` mechanism graphify just used. This
   directly closes the gap this doc documents. (Scope note: decide
   whether docs and config commits are exempt, or the hook will nag on
   every non-code commit.)
3. **Leave the rest advisory but make them explicit stop-conditions in
   each `/goal` pass.** HTML mockups, Plan First, model routing, and
   scope discipline resist clean mechanization. Instead of trusting them
   to surface, write them into the acceptance criteria of each pass so a
   pass is not "done" until they are visibly satisfied. An explicit
   checklist per goal is itself a weak mechanism.
4. **Re-read this doc at the start of each `/goal` pass.** Until the
   mechanizable rules are hooks, the mitigation is deliberate: this doc
   plus `watch-items.md` are the two files a pass should open before
   planning, the same way search precedence now opens the graph first.

## Open decisions for Mo

1. Which advisory rules are worth the cost of a hook, and which stay
   prose. (Recommendation above: quiz yes, TDD partial, the rest no.)
2. Whether docs and config commits are exempt from the quiz gate.

**Resolved, 2026-07-10:** whether a durable record was needed for the
graphify search-precedence + hooks change (formerly open item #4). The
mechanism already existed: Quiz Before Merging, in Mo's global CLAUDE.md,
triggers on any commit, not on goal-scoped work. The gap was that it
didn't fire, not that no mechanism existed; see the evidence section
above. Fix applied: the retroactive quiz entry now exists at
`docs/qa/2026-07-10-graphify-search-precedence.md`, logged in
`docs/qa/CHECKLIST.md`. Standing note for future passes: Quiz Before
Merging applies to any committed change with real architectural weight,
goal open or not, so this doesn't recur silently.
