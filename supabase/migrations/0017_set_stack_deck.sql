-- Argo schema track, migration 0017: set_stack_deck.
-- Deck assignment is library organization, the same gesture class as
-- Kanban placement, so any org member may do it (build log D-ST-8). The
-- qstacks_update policy is deliberately NOT widened: it would expose
-- title, visibility, and every other column to non-owners. This
-- security-definer function is the narrow path instead: it verifies
-- caller org membership and updates deck_id, nothing else. The same-org
-- deck rule stays enforced by the composite FK from 0014, which fires
-- inside this function like anywhere else.

create or replace function public.set_stack_deck(p_stack uuid, p_deck uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from qstacks where id = p_stack;
  if v_org is null then
    raise exception 'stack not found';
  end if;
  if not is_org_member(v_org) then
    raise exception 'not a member of this stack''s org';
  end if;
  update qstacks set deck_id = p_deck where id = p_stack;
end;
$$;

-- Grant hygiene per the 0011 pattern: authenticated members only.
revoke execute on function public.set_stack_deck(uuid, uuid) from anon;
