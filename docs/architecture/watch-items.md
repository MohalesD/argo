# Architecture Watch Items

Findings from Graphify structural traces worth tracking over time: not bugs,
not action items, just things to check before touching related code. Add a
new entry each time a trace surfaces something like this. Mark status as
WATCH or RESOLVED, update in place rather than duplicating entries.

## Shared-record type contract only exists for briefs

**Date:** 2026-07-10
**Status:** WATCH
**Source:** Graphify trace of the 243 weakly-connected nodes (ResponseInfo, ShareRow, InterviewRow)

Argo's architecture doctrine (this CLAUDE.md, PRD) commits to a shared-record
model from day one: interviewer, hiring manager, and team all touch the same
records. Right now that commitment is only realized in code for briefs:
src/lib/brief.ts defines BriefContent/BriefClaim once, reused by BriefRow and
ClaimView(). Interviews, shares, and responses have no equivalent: each page
(interviews/page.tsx, briefs/[id]/page.tsx, share/[token]/page.tsx) declares
its own private inline row type with no shared definition.

Specific asymmetry worth checking before extending sharing/interviews: ShareRow
(owner view, in the brief page) and the SharedBrief type (token view, in
share/[token]/page.tsx) describe the same sharing surface from opposite ends
and may not agree on shape, not yet verified.

**Before building out interview or response sharing further: decide whether
these need a shared typed contract like brief.ts, or whether staying
page-local is intentional for now.**

## QStackRow does not yet read stage or deck_id

**Date:** 2026-07-12
**Status:** WATCH
**Source:** Schema/backend track (migrations 0013-0017, hosted-verified)

QStackRow in components/QStackCard.tsx does not yet read stage or deck_id,
both now live on hosted as of migration 0013-0017. The visual track that
would normally consume this closed before schema landed. Whoever picks up
QStack UI work next needs to wire these two fields before Canvas or the
deck page can render real stage pills or deck membership from live data.
