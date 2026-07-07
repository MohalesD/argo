-- Argo Goal 2, migration 0010: security-definer functions.
-- Anonymous tokenized brief access is deliberately NOT an RLS path
-- (Goal 1 watched item 4): a token in a URL is a capability, and the
-- validation logic (expiry, revocation, dead-end behavior) belongs in
-- one function, not scattered across policies.

-- Shared-brief read for anon viewers. Returns null for unknown,
-- revoked, or expired tokens so the UI renders a dead end that leaks
-- nothing (PRD 5.8). Every successful call records a view event in
-- invites (accepted_user_id null = a view; conversion rows set it).
create or replace function public.get_shared_brief(p_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_share brief_shares%rowtype;
  v_result jsonb;
begin
  select * into v_share from brief_shares
  where token = p_token
    and revoked_at is null
    and expires_at > now();
  if not found then
    return null;
  end if;

  insert into invites (share_id) values (v_share.id);

  select jsonb_build_object(
    'brief_id', b.id,
    'content', b.content,
    'status', b.status,
    'candidate_name', i.candidate_name,
    'role', i.role,
    'shared_by', coalesce(u.first_name, ''),
    'expires_at', v_share.expires_at
  ) into v_result
  from briefs b
  join interviews i on i.id = b.interview_id
  join users u on u.id = v_share.created_by
  where b.id = v_share.brief_id;
  return v_result;
end;
$$;

grant execute on function public.get_shared_brief(text) to anon, authenticated;

-- Conversion event: called by the newly signed-up (authenticated) user
-- who arrived through a share link. One row per conversion.
create or replace function public.accept_share_invite(p_token text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_share_id uuid;
begin
  if auth.uid() is null then
    raise exception 'accept_share_invite requires an authenticated user';
  end if;
  select id into v_share_id from brief_shares
  where token = p_token and revoked_at is null and expires_at > now();
  if v_share_id is null then
    return;
  end if;
  if not exists (
    select 1 from invites
    where share_id = v_share_id and accepted_user_id = auth.uid()
  ) then
    insert into invites (share_id, accepted_user_id, accepted_at)
    values (v_share_id, auth.uid(), now());
  end if;
end;
$$;

grant execute on function public.accept_share_invite(text) to authenticated;

-- Atomic clone with lineage (PRD 5.2.4). Definer so the copy of
-- qstack_items happens in one transaction regardless of per-row RLS
-- timing; visibility is re-checked explicitly because definer bypasses
-- policies. Flagged and pending questions belonging to others never
-- travel with a clone (PRD 5.3 hard rule 1).
create or replace function public.clone_qstack(p_source uuid, p_org uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_source qstacks%rowtype;
  v_new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'clone_qstack requires an authenticated user';
  end if;
  if not exists (
    select 1 from org_members m where m.org_id = p_org and m.user_id = auth.uid()
  ) then
    raise exception 'caller is not a member of the target org';
  end if;

  select * into v_source from qstacks q
  where q.id = p_source
    and (
      q.visibility = 'public'
      or q.owner_id = auth.uid()
      or (q.visibility = 'org' and exists (
        select 1 from org_members m
        where m.org_id = q.org_id and m.user_id = auth.uid()
      ))
    );
  if not found then
    raise exception 'source qstack not found or not visible to caller';
  end if;

  insert into qstacks (org_id, owner_id, title, role_family, level,
                       methodology, visibility, forked_from_id)
  values (p_org, auth.uid(), v_source.title, v_source.role_family,
          v_source.level, v_source.methodology, 'private', v_source.id)
  returning id into v_new_id;

  insert into qstack_items (qstack_id, question_id, position, rubric, followups)
  select v_new_id, qi.question_id, qi.position, qi.rubric, qi.followups
  from qstack_items qi
  join questions q on q.id = qi.question_id
  where qi.qstack_id = v_source.id
    and (q.screening_status = 'passed' or q.contributed_by = auth.uid());

  return v_new_id;
end;
$$;

grant execute on function public.clone_qstack(uuid, uuid) to authenticated;
