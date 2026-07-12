-- Argo schema track, migration 0018: close the PUBLIC EXECUTE gap
-- (build log D-ST-10). Postgres grants EXECUTE to PUBLIC by default on
-- function creation, and every role implicitly inherits PUBLIC's
-- grants regardless of a role-specific revoke, so 0011's
-- `revoke ... from anon` never actually closed the door on these five
-- definer functions. This migration revokes from PUBLIC directly,
-- which is the only revoke that matters. Role-specific grants already
-- in place (authenticated, service_role) are untouched: revoking a
-- PUBLIC grant does not remove separately granted role privileges.
--
-- Signatures confirmed against pg_proc directly before writing this
-- migration, not assumed from memory; no overloads exist for any of
-- the five names.

revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.clone_qstack(uuid, uuid) from public;
revoke execute on function public.accept_share_invite(text) from public;
revoke execute on function public.create_org(text) from public;
revoke execute on function public.set_stack_deck(uuid, uuid) from public;
