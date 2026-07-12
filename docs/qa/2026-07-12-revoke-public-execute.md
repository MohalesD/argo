# QA: revoke PUBLIC execute, D-ST-10 fix (2026-07-12)

## Files changed

1. `supabase/migrations/0018_revoke_public_execute.sql` (new)
2. `evals/suites/schema-grant-hygiene.ts` (new, Test Author subagents,
   including a follow-up type-check fix)
3. `.claude/handoff/navigator.md` (D-ST-10 section appended, then a
   short type-check-fix note added to it)
4. `buildlog/schema-track-build-log.md` (shipped items 11-12, D-ST-10
   marked fixed)
5. `docs/qa/2026-07-12-revoke-public-execute.md` (this file)
6. `docs/qa/CHECKLIST.md`
7. `tasks/todo.md`

## Logic in one sentence

Postgres grants EXECUTE to PUBLIC by default on function creation and
every role inherits PUBLIC's grants regardless of a role-specific
revoke, so 0011's anon-only revoke never closed the door on five
definer functions; 0018 revokes from PUBLIC directly, the only revoke
that actually matters, on the exact signatures confirmed against
pg_proc.

## Quiz

**Q: Why does revoking EXECUTE from PUBLIC not also strip the
EXECUTE grants that authenticated and service_role already hold on
these five functions, and how did the suite prove that rather than
assume it?**

A: PUBLIC and a named role are independent grantees in Postgres's ACL
model; a role's own explicit grant is a separate ACL entry from
whatever PUBLIC holds, and revoking one grantee's privilege never
touches another grantee's separately recorded privilege on the same
object. This isn't asserted from documentation alone: the suite's own
green-state detail strings show the grantee list after 0018 as
`[postgres, authenticated, service_role]` for every one of the five
functions, PUBLIC absent and the other three intact, read live from
pg_proc's ACL via aclexplode, not inferred. PASS.

## Verification

Local fresh rebuild applies all 18 migrations clean.
`schema-grant-hygiene` 5/5 green (was 5/5 red on the correct
PUBLIC-still-granted reason before 0018), `schema-deck-stars` 37/37,
`schema-qdeck-canvas` 39/39, `rls-probe` green, `type-check` clean
(after a Test Author fixed two strict-array-index type errors in the
new suite without changing its behavior; suite stayed 5/5 green
throughout that fix). Hosted untouched; held for Mo's go-ahead per
standing discipline.
