# QA: Goal 3 hardening, TypeScript cleanup + concurrent starring

**Date:** 2026-07-19
**Track:** harden-track
**Scope:** `tests/e2e/interview-keyboard.spec.ts`, `tests/e2e/interview-touch.spec.ts`, new `tests/e2e/concurrent-starring.spec.ts`, `buildlog/goal3-hardening-build-log.md`

## What changed

1. Fixed the 8 pre-existing `TS2532: Object is possibly 'undefined'`
   errors in `interview-keyboard.spec.ts` and `interview-touch.spec.ts`
   (4 each, same two call sites in both files) with non-null assertions
   (`questions[0]!`, `questions[1]!`), justified by the already-present
   runtime length check two lines above each site. No behavioral change;
   `npm run type-check` went from 8 errors to 0, and both specs still
   pass unchanged against the local dev server.
2. Added `tests/e2e/concurrent-starring.spec.ts`, closing Goal 2's
   could-not-verify item 2 (concurrent starring at real concurrency).
   Two tests, both driving genuine concurrency via independent real
   `BrowserContext`s clicking the production star-button through
   `Promise.all`, not sequential requests:
   - 4 distinct users racing the same QStack: exactly 4 rows land in
     `stars`, `qstacks.star_count` reaches exactly 4.
   - The same user racing two of their own sessions against the same
     QStack: exactly 1 row lands, the unique index rejects the loser,
     `toggleStar`'s existing error branch reconciles it rather than
     silently no-oping.

## Quiz

**Q: Why does asserting `star-count` reads "4" on each of the 4 distinct
users' own pages fail, and why is that not a bug in the starring
feature?**

**A:** `app/market/page.tsx` has no realtime subscription — each page's
`star-count` is a one-time fetch at load plus a local optimistic ±1
delta. Since all 4 users loaded `/market` before any of them starred,
each page's own view only ever reflects its own action (0→1), never the
other three sessions' inserts, unless it reloads. That's a deliberate
absence of live cross-session sync, not a defect. Verifying the real
aggregate (4 distinct rows, `star_count == 4`) requires reading the
database directly, which the test does via a service-role client used
only for verification, never for the writes that produce the race.

## Verification run (both, against hosted via local dev server)

```
✓ interview-keyboard.spec.ts: a full session runs start to finish using only the keyboard (9.1s)
✓ interview-touch.spec.ts: a full session runs start to finish using only touch (6.1s)
✓ concurrent-starring.spec.ts: N distinct users racing the same QStack land exactly N stars, no over- or under-count (21.1s)
✓ concurrent-starring.spec.ts: the same user racing two sessions against the same QStack lands exactly one star, the unique constraint rejects the loser (7.2s)
```

**Quiz: PASS**
