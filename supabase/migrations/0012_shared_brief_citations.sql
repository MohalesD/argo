-- Argo Goal 2, migration 0012: the shared-brief view resolves its
-- citations. get_shared_brief now returns the cited responses (and only
-- the cited ones) so a link recipient can verify claims the same way an
-- org member can. Uncited responses never leave the org boundary.
create or replace function public.get_shared_brief(p_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_share brief_shares%rowtype;
  v_content jsonb;
  v_cited jsonb;
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

  select b.content into v_content from briefs b where b.id = v_share.brief_id;

  with claim_citations as (
    select jsonb_array_elements_text(claim->'citations') as cid
    from jsonb_array_elements(coalesce(v_content->'sections', '[]'::jsonb)) as section,
         jsonb_array_elements(coalesce(section->'claims', '[]'::jsonb)) as claim
    union
    select jsonb_array_elements_text(starred->'citations')
    from jsonb_array_elements(coalesce(v_content->'starred_moments', '[]'::jsonb)) as starred
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'question', q.text,
    'text', r.response_text
  )), '[]'::jsonb)
  into v_cited
  from responses r
  join questions q on q.id = r.question_id
  where r.id::text in (select cid from claim_citations);

  select jsonb_build_object(
    'brief_id', b.id,
    'content', b.content,
    'status', b.status,
    'candidate_name', i.candidate_name,
    'role', i.role,
    'shared_by', coalesce(u.first_name, ''),
    'expires_at', v_share.expires_at,
    'cited_responses', v_cited
  ) into v_result
  from briefs b
  join interviews i on i.id = b.interview_id
  join users u on u.id = v_share.created_by
  where b.id = v_share.brief_id;
  return v_result;
end;
$$;
