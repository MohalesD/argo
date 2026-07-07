-- Argo Goal 1, migration 0007: row-level security.
-- RLS at the database layer is the tenancy boundary (PRD 4.2, D2).
-- Policies are allowlists: any operation without a policy is denied for
-- anon and authenticated. service_role bypasses RLS by role attribute;
-- where that is not acceptable (scores, session states) triggers in
-- migration 0008 bind every caller.

-- Membership helpers. security definer so policies on org_members can
-- reference membership without recursive RLS evaluation.
create or replace function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from org_members m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from org_members m
    where m.org_id = p_org and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.shares_org_with(p_user uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from org_members mine
    join org_members theirs on theirs.org_id = mine.org_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
$$;

-- Enable RLS on every table.
alter table public.orgs enable row level security;
alter table public.users enable row level security;
alter table public.org_members enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.follows enable row level security;
alter table public.qstacks enable row level security;
alter table public.questions enable row level security;
alter table public.qstack_items enable row level security;
alter table public.kanban_columns enable row level security;
alter table public.qstack_positions enable row level security;
alter table public.stars enable row level security;
alter table public.interviews enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.consents enable row level security;
alter table public.responses enable row level security;
alter table public.scores enable row level security;
alter table public.mentions enable row level security;
alter table public.briefs enable row level security;
alter table public.brief_shares enable row level security;
alter table public.invites enable row level security;
alter table public.notifications enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.ai_calls enable row level security;
alter table public.eval_runs enable row level security;

-- orgs: members read; admins rename; creation via create_org() only.
create policy orgs_select on public.orgs
  for select to authenticated using (public.is_org_member(id));
create policy orgs_update on public.orgs
  for update to authenticated
  using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- users: own row, plus users who share an org (needed for mentions and
-- shared records). Row creation happens in the auth signup trigger.
create policy users_select on public.users
  for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));
create policy users_update on public.users
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- org_members: members see their org roster; admins manage it.
create policy org_members_select on public.org_members
  for select to authenticated using (public.is_org_member(org_id));
create policy org_members_insert on public.org_members
  for insert to authenticated with check (public.is_org_admin(org_id));
create policy org_members_update on public.org_members
  for update to authenticated
  using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy org_members_delete on public.org_members
  for delete to authenticated
  using (public.is_org_admin(org_id) or user_id = auth.uid());

-- profiles: default private; public is explicit (PRD 5.9, D12).
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy profiles_select_public on public.profiles
  for select to anon, authenticated using (visibility = 'public');
create policy profiles_insert on public.profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- posts: visible when the author's profile is public; authors manage.
create policy posts_select_public on public.posts
  for select to anon, authenticated
  using (exists (
    select 1 from public.profiles p
    where p.user_id = posts.author_id and p.visibility = 'public'
  ));
create policy posts_select_own on public.posts
  for select to authenticated using (author_id = auth.uid());
create policy posts_insert on public.posts
  for insert to authenticated with check (author_id = auth.uid());
create policy posts_delete on public.posts
  for delete to authenticated using (author_id = auth.uid());

-- follows: parties see their own edges; follower manages the edge.
create policy follows_select on public.follows
  for select to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());
create policy follows_insert on public.follows
  for insert to authenticated with check (follower_id = auth.uid());
create policy follows_delete on public.follows
  for delete to authenticated using (follower_id = auth.uid());

-- qstacks: public is explicit; org visibility for members; private is
-- owner-only. Two users in different orgs never see each other's rows.
create policy qstacks_select_public on public.qstacks
  for select to anon, authenticated using (visibility = 'public');
create policy qstacks_select_org on public.qstacks
  for select to authenticated
  using (visibility = 'org' and public.is_org_member(org_id));
create policy qstacks_select_own on public.qstacks
  for select to authenticated using (owner_id = auth.uid());
create policy qstacks_insert on public.qstacks
  for insert to authenticated
  with check (owner_id = auth.uid() and public.is_org_member(org_id));
create policy qstacks_update on public.qstacks
  for update to authenticated
  using (owner_id = auth.uid() or public.is_org_admin(org_id))
  with check (public.is_org_member(org_id));
create policy qstacks_delete on public.qstacks
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_org_admin(org_id));

-- questions: the shared bank. Hard rule (PRD 5.3): flagged questions
-- never surface anywhere except to their author, with the flag reason.
-- Pending questions are likewise author-only until screened. Users
-- cannot set their own screening status: contributions enter 'pending'
-- and only the service-side classifier pipeline promotes them.
create policy questions_select_passed on public.questions
  for select to anon, authenticated using (screening_status = 'passed');
create policy questions_select_own on public.questions
  for select to authenticated using (contributed_by = auth.uid());
create policy questions_insert on public.questions
  for insert to authenticated
  with check (
    contributed_by = auth.uid()
    and screening_status = 'pending'
    and verification is null
  );

-- qstack_items: visible with their parent qstack; mutable by the parent
-- owner or an org admin.
create policy qstack_items_select on public.qstack_items
  for select to anon, authenticated
  using (exists (select 1 from public.qstacks q where q.id = qstack_id));
create policy qstack_items_write on public.qstack_items
  for all to authenticated
  using (exists (
    select 1 from public.qstacks q
    where q.id = qstack_id
      and (q.owner_id = auth.uid() or public.is_org_admin(q.org_id))
  ))
  with check (exists (
    select 1 from public.qstacks q
    where q.id = qstack_id
      and (q.owner_id = auth.uid() or public.is_org_admin(q.org_id))
  ));

-- kanban_columns: org-defined; members organize their own board.
create policy kanban_columns_all on public.kanban_columns
  for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- qstack_positions: scoped through the column's org.
create policy qstack_positions_all on public.qstack_positions
  for all to authenticated
  using (exists (
    select 1 from public.kanban_columns c
    where c.id = column_id and public.is_org_member(c.org_id)
  ))
  with check (exists (
    select 1 from public.kanban_columns c
    where c.id = column_id and public.is_org_member(c.org_id)
  ));

-- stars: one per user per qstack; starrable only if the qstack is
-- visible to you (subquery runs under qstacks RLS).
create policy stars_select_own on public.stars
  for select to authenticated using (user_id = auth.uid());
create policy stars_insert on public.stars
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.qstacks q where q.id = qstack_id)
  );
create policy stars_delete on public.stars
  for delete to authenticated using (user_id = auth.uid());

-- interviews: org-scoped, members only. No public path ever.
create policy interviews_all on public.interviews
  for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- interview_sessions: through the interview's org. No delete: sessions
-- are records. State transitions gated by trigger in 0008.
create policy sessions_select on public.interview_sessions
  for select to authenticated
  using (exists (
    select 1 from public.interviews i
    where i.id = interview_id and public.is_org_member(i.org_id)
  ));
create policy sessions_insert on public.interview_sessions
  for insert to authenticated
  with check (exists (
    select 1 from public.interviews i
    where i.id = interview_id and public.is_org_member(i.org_id)
  ));
create policy sessions_update on public.interview_sessions
  for update to authenticated
  using (exists (
    select 1 from public.interviews i
    where i.id = interview_id and public.is_org_member(i.org_id)
  ))
  with check (exists (
    select 1 from public.interviews i
    where i.id = interview_id and public.is_org_member(i.org_id)
  ));

-- consents: append-only records through the session's org chain.
create policy consents_select on public.consents
  for select to authenticated
  using (exists (
    select 1 from public.interview_sessions s
    join public.interviews i on i.id = s.interview_id
    where s.id = session_id and public.is_org_member(i.org_id)
  ));
create policy consents_insert on public.consents
  for insert to authenticated
  with check (
    recorded_by = auth.uid()
    and exists (
      select 1 from public.interview_sessions s
      join public.interviews i on i.id = s.interview_id
      where s.id = session_id and public.is_org_member(i.org_id)
    )
  );

-- responses: through the session's org chain. Editable during capture,
-- never deletable by users: they are the interview record.
create policy responses_select on public.responses
  for select to authenticated
  using (exists (
    select 1 from public.interview_sessions s
    join public.interviews i on i.id = s.interview_id
    where s.id = session_id and public.is_org_member(i.org_id)
  ));
create policy responses_insert on public.responses
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.interview_sessions s
      join public.interviews i on i.id = s.interview_id
      where s.id = session_id and public.is_org_member(i.org_id)
    )
  );
create policy responses_update on public.responses
  for update to authenticated
  using (exists (
    select 1 from public.interview_sessions s
    join public.interviews i on i.id = s.interview_id
    where s.id = session_id and public.is_org_member(i.org_id)
  ))
  with check (exists (
    select 1 from public.interview_sessions s
    join public.interviews i on i.id = s.interview_id
    where s.id = session_id and public.is_org_member(i.org_id)
  ));

-- scores: append-only events (PRD 5.6, D11). Insert and select only;
-- no UPDATE or DELETE policy exists, and the 0008 trigger blocks even
-- service_role. v1 writes scorer_type 'human' with the caller's id.
create policy scores_select on public.scores
  for select to authenticated
  using (exists (
    select 1 from public.responses r
    join public.interview_sessions s on s.id = r.session_id
    join public.interviews i on i.id = s.interview_id
    where r.id = response_id and public.is_org_member(i.org_id)
  ));
create policy scores_insert on public.scores
  for insert to authenticated
  with check (
    scorer_type = 'human'
    and scorer_id = auth.uid()
    and exists (
      select 1 from public.responses r
      join public.interview_sessions s on s.id = r.session_id
      join public.interviews i on i.id = s.interview_id
      where r.id = response_id and public.is_org_member(i.org_id)
    )
  );

-- mentions: team-visible through the response's org chain.
create policy mentions_select on public.mentions
  for select to authenticated
  using (
    mentioned_user_id = auth.uid()
    or exists (
      select 1 from public.responses r
      join public.interview_sessions s on s.id = r.session_id
      join public.interviews i on i.id = s.interview_id
      where r.id = response_id and public.is_org_member(i.org_id)
    )
  );
create policy mentions_insert on public.mentions
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.responses r
      join public.interview_sessions s on s.id = r.session_id
      join public.interviews i on i.id = s.interview_id
      where r.id = response_id and public.is_org_member(i.org_id)
    )
  );

-- briefs: org-scoped through the interview. Tokenized public access is
-- an edge-function concern (Goal 2), never a direct anon table read.
create policy briefs_select on public.briefs
  for select to authenticated
  using (exists (
    select 1 from public.interviews i
    where i.id = interview_id and public.is_org_member(i.org_id)
  ));
create policy briefs_insert on public.briefs
  for insert to authenticated
  with check (exists (
    select 1 from public.interviews i
    where i.id = interview_id and public.is_org_member(i.org_id)
  ));
create policy briefs_update on public.briefs
  for update to authenticated
  using (exists (
    select 1 from public.interviews i
    where i.id = interview_id and public.is_org_member(i.org_id)
  ))
  with check (exists (
    select 1 from public.interviews i
    where i.id = interview_id and public.is_org_member(i.org_id)
  ));

-- brief_shares: managed by the sharing org; revocation is an update.
create policy brief_shares_select on public.brief_shares
  for select to authenticated
  using (exists (
    select 1 from public.briefs b
    join public.interviews i on i.id = b.interview_id
    where b.id = brief_id and public.is_org_member(i.org_id)
  ));
create policy brief_shares_insert on public.brief_shares
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.briefs b
      join public.interviews i on i.id = b.interview_id
      where b.id = brief_id and public.is_org_member(i.org_id)
    )
  );
create policy brief_shares_update on public.brief_shares
  for update to authenticated
  using (exists (
    select 1 from public.briefs b
    join public.interviews i on i.id = b.interview_id
    where b.id = brief_id and public.is_org_member(i.org_id)
  ))
  with check (exists (
    select 1 from public.briefs b
    join public.interviews i on i.id = b.interview_id
    where b.id = brief_id and public.is_org_member(i.org_id)
  ));

-- invites: sharers see conversion; accepted users see their own.
create policy invites_select on public.invites
  for select to authenticated
  using (
    accepted_user_id = auth.uid()
    or exists (
      select 1 from public.brief_shares bs
      join public.briefs b on b.id = bs.brief_id
      join public.interviews i on i.id = b.interview_id
      where bs.id = share_id and public.is_org_member(i.org_id)
    )
  );

-- notifications: own only; created by service-side code.
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- marketplace_listings: browsable where the qstack is public; managed
-- by the qstack owner or org admin.
create policy listings_select on public.marketplace_listings
  for select to anon, authenticated
  using (exists (
    select 1 from public.qstacks q
    where q.id = qstack_id and q.visibility = 'public'
  ));
create policy listings_write on public.marketplace_listings
  for all to authenticated
  using (exists (
    select 1 from public.qstacks q
    where q.id = qstack_id
      and (q.owner_id = auth.uid() or public.is_org_admin(q.org_id))
  ))
  with check (exists (
    select 1 from public.qstacks q
    where q.id = qstack_id
      and (q.owner_id = auth.uid() or public.is_org_admin(q.org_id))
  ));

-- ai_calls and eval_runs: service-side ledgers. No policies for anon or
-- authenticated: all direct user access is denied.
