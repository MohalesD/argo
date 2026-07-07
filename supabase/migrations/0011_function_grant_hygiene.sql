-- Argo Goal 2, migration 0011: function EXECUTE hygiene.
-- Hosted default privileges grant EXECUTE on new functions to anon and
-- authenticated. Tighten to the designed surface (Supabase security
-- advisor findings, July 7, 2026):
-- 1. get_shared_brief: anon + authenticated (the tokenized share path).
-- 2. accept_share_invite, clone_qstack, create_org: authenticated only.
-- 3. Everything else (trigger functions, membership helpers): no
--    direct RPC callers. Trigger functions cannot be invoked via RPC
--    anyway; revoking is defense in depth.

revoke execute on function public.accept_share_invite(text) from anon;
revoke execute on function public.clone_qstack(uuid, uuid) from anon;
revoke execute on function public.create_org(text) from anon;

revoke execute on function public.is_org_member(uuid) from anon;
revoke execute on function public.is_org_admin(uuid) from anon;
revoke execute on function public.shares_org_with(uuid) from anon;

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.enforce_session_state() from anon, authenticated;
revoke execute on function public.scores_append_only() from anon, authenticated;
revoke execute on function public.validate_score_supersede() from anon, authenticated;
revoke execute on function public.maintain_star_count() from anon, authenticated;
revoke execute on function public.notify_mention() from anon, authenticated;
revoke execute on function public.notify_publish() from anon, authenticated;
revoke execute on function public.notify_contribution_accepted() from anon, authenticated;

-- Advisor: scores_append_only had a mutable search_path. It references
-- no objects (it only raises), but pin it anyway.
alter function public.scores_append_only() set search_path = public;
