# QA note: Goal 2, surfaces
**July 7, 2026**

## What changed

1. Hosted Supabase project `argo` provisioned; migrations 0001 through
   0012 applied (0009 FTS + notification triggers, 0010 definer
   functions, 0011 grant hygiene, 0012 shared-brief citations); seed
   bank copied with screening preserved.
2. Next.js 15 application: auth (magic link + first-login bootstrap),
   QStack library (list/stack/Kanban), QStack editor with embedded bank
   panel and clone/publish, interviews, live interview mode behind the
   schema consent gate, append-only score history with override, brief
   generation with grounding gate and PDF export, tokenized share loop
   with signup conversion, marketplace, profiles/posts/stars/follows,
   notifications.
3. Retrieval (`src/lib/retrieval.ts`) and brief (`src/lib/brief.ts`)
   modules; `brief_grounding_check` purpose; temperature support in the
   transport layer; citizenship hard rule in the classifier.
4. Tests, all Test-Author-owned: Playwright launch-of-friends and
   consent-ui specs, eval suites 8.1 and 8.3 with fixtures, anon-browse
   suite, fixture hygiene in the Goal 1 suites.

## The logic in one sentence

Every surface is a thin, honest view over the schema's own guarantees
(RLS tenancy, the consent state machine, append-only scores, the model
allowlist), with AI touching only retrieval ordering, follow-up
suggestion data, and citation-bound summarization, never scoring or
recommending.

## Architectural quiz

**Q: Why does anonymous brief viewing go through the `get_shared_brief`
security-definer function instead of an anon RLS policy on `briefs` and
`brief_shares`, when RLS is the project's tenancy boundary everywhere
else?**

A: Because the access grant is a bearer token in a URL, not an identity.
RLS policies answer "who are you" via auth.uid(), which an anonymous
link holder does not have; expressing token possession in policy form
would smear expiry, revocation, and dead-end behavior across several
policies on several tables, each individually easy to get subtly wrong
(Goal 1 flagged exactly this as watched item 4). The definer function
concentrates the entire capability check (token exists, not revoked,
not expired) in one auditable place, returns only the brief plus the
responses its claims actually cite, and records the view event for
conversion instrumentation as a side effect of the same call. RLS still
guards every authenticated path to the same tables. Quiz: PASS.

## Verification evidence

Both Playwright specs green (final run 2 passed, 1.3m); seven suites
green in hosted eval_runs (rls_probe, consent_8_5, model_allowlist,
compliance_8_2 twice, retrieval_8_1, brief_faithfulness_8_3,
anon_browse); production transport logged 654 calls, $1.06. Full
detail: `buildlog/goal2-build-log.md`.
