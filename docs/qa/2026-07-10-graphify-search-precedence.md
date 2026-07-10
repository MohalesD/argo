# QA note: graphify search precedence + hooks

**July 10, 2026 · retroactive: written after the commit, not before it
(see Architectural quiz for why)**

## What changed

1. `CLAUDE.md`: Fable 5 access window extended to July 12, 2026, with the
   July 10-12 evolution push noted; new "Search precedence for codebase
   questions" section; new "graphify" section (written by
   `graphify claude install`) documenting `graphify query`/`path`/`explain`
   and the update-after-code-changes rule; "Project files" map extended to
   cover `docs/architecture/`, `docs/qa/`, `buildlog/`, and `tasks/todo.md`.
2. `.claude/settings.json` (new file): `PreToolUse` hooks registered by
   `graphify claude install`: `graphify hook-guard search` on every
   `Bash` call, `graphify hook-guard read` on every `Read`/`Glob` call.
3. `.gitignore`: added `graphify-out/` (regenerable build output).
4. `docs/architecture/watch-items.md` (new file): running log for
   structural findings from graphify traces.
5. `.git/hooks/post-commit` and `.git/hooks/post-checkout` (local, not
   versioned): installed via `graphify hook install`. After a commit or
   branch switch, detects changed code files and rebuilds `graph.json`
   in a detached background process, AST-only, no LLM cost, skipping
   itself during rebase/merge/cherry-pick and when only `graphify-out/`
   changed.

## The logic in one sentence

Agents must query the knowledge graph before grepping or reading files
for structural questions, and the two PreToolUse hooks make that
precedence self-enforcing at the tool-call layer instead of relying on
the agent to remember a prose rule in CLAUDE.md.

## Architectural quiz

**Q: This change shipped without a Quiz Before Merging entry at commit
time, even though the rule's trigger is "before committing," not "inside
an open goal." Why did an unconditional, always-active rule fail to
fire, and does a hook-guard mechanism prevent the same class of miss
from happening to itself?**

A: It failed to fire because Quiz Before Merging is advisory, not
enforced: it depends on the agent recognizing "this is a commit" and
choosing to act, with nothing watching `git commit` itself. In a session
already carrying a multi-step graphify pipeline, a memory system, and two
CLAUDE.md files, that recognition step didn't happen. The hook-guard
mechanism this change installs does not have the same exposure for its
own domain, because it is enforced, not advisory: it fires on every
`Bash`/`Read`/`Glob` call regardless of whether the agent remembers to
invoke it, the same way a database CHECK constraint enforces the model
allowlist regardless of whether an agent remembers to check it. But
hook-guard only covers search precedence; it does nothing for the quiz
gate itself, which remains advisory and exposed to the identical failure
mode until it is mechanized the same way. Quiz: PASS (failure mode
identified, scoped, and not treated as a reason to leave the gap silent).

## Verification evidence

`.claude/settings.json` hooks confirmed present and matching the install
output (`hook-guard search` on `Bash`, `hook-guard read` on `Read|Glob`).
`CLAUDE.md` diff reviewed and approved by Mo before commit. Full
narrative: this conversation's transcript, 2026-07-10.
