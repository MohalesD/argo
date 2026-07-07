# Anon-browse eval suite: handoff

Closes the Goal 1 watched item: "Marketplace anon-browse policies exist;
confirm they match the Goal 2 surface design before exposing publicly."

## Files created

1. `evals/suites/anon-browse.ts`: the suite (34 checks, local `asAnon`
   helper, fixtures, cleanup).
2. `package.json`: added one script line, `"eval:anon": "tsx
   evals/suites/anon-browse.ts"`. No other lines touched.

## Status: GREEN

`npm run eval:anon` against the local database (127.0.0.1:5799, schema
through migration 0011, seeded bank present): 34/34 checks pass, exit
code 0. Run twice in a row to confirm fixture isolation (random run id)
and cleanup both hold; both runs recorded GREEN to `eval_runs` under
suite name `anon_browse`. Verified separately that zero fixture rows
(orgs, auth users, flagged/pending fixture questions) remain after each
run.

No gap found. Existing RLS policies in `0007_rls_policies.sql` already
match the anon-browse design exactly as specified.

## Check list summary

Fixtures (built as admin, tagged `anonprobe_<run>`, three
`createUserWithOrg` fixture users, one public qstack, one private
qstack, one org-visibility qstack, all three carrying a qstack_item
that reuses an existing passed bank question, a listing on the public
and on the private qstack, one flagged and one pending fixture question,
one public and one private profile each with one post).

1. Allowed reads (6 checks, all PASS): public qstack, its qstack_items,
   a passed bank question, a public profile, a post by a public-profile
   author, a listing on the public qstack.
2. Forbidden reads scoped to fixture rows (12 checks, all PASS): private
   qstack, org-visibility qstack, qstack_items of each, flagged
   question, pending question, private profile, post by a private-profile
   author, the fixture org row, its org_members rows, the fixture user
   row, listing on the private qstack.
3. Forbidden reads, blanket zero-anon-policy tables (12 checks, all
   PASS): interviews, interview_sessions, consents, responses, scores,
   mentions, briefs, brief_shares, invites, notifications, ai_calls,
   eval_runs. These carry no anon policy at all, so a table-wide count
   is a valid probe regardless of what other suites' fixtures leave
   behind in the local database.
4. Forbidden writes (4 checks, all PASS): anon insert blocked on
   qstacks, questions, stars, posts, each failing with "new row violates
   row-level security policy."

## Notes

1. `qstack_items_select` relies on RLS recursing into the `qstacks`
   table's own policies inside its `EXISTS` subquery rather than
   re-checking `visibility` directly; confirmed this is intentional
   (matches the recursion pattern the migration's own comment describes
   for `org_members`), and the suite's private/org qstack_items checks
   pass because of it, not despite it.
2. Cleanup deletes the fixture questions explicitly, then the three
   fixture orgs (cascades qstacks, qstack_items, kanban_columns,
   qstack_positions, marketplace_listings, org_members), then the three
   fixture auth users (cascades public.users, profiles, posts). Wrapped
   in try/catch, tolerated silently; no trigger was touched or worked
   around.
