-- Argo Goal 1, migration 0008: integrity triggers.
-- Triggers bind every caller, including service_role and table owners,
-- which is why the consent gate and score append-only rules live here
-- rather than only in RLS.

-- 1. Interview session state machine (PRD 5.5.1, eval 8.5).
--    created -> consented -> capturing -> ended, with ended reachable
--    from any earlier state as an abandon/cancel path. There is no path
--    into 'capturing' that has not passed through 'consented', and
--    'consented' requires at least one stored consent record.
create or replace function public.enforce_session_state() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.state <> 'created' then
      raise exception 'interview sessions must start in state ''created'', got ''%''', new.state;
    end if;
    return new;
  end if;

  if old.state = new.state then
    return new;
  end if;

  if old.state = 'ended' then
    raise exception 'session is ended; no further state changes are allowed';
  end if;

  if new.state = 'created' then
    raise exception 'sessions cannot return to ''created''';
  end if;

  if new.state = 'consented' then
    if old.state <> 'created' then
      raise exception 'invalid transition % -> consented', old.state;
    end if;
    if not exists (select 1 from consents c where c.session_id = new.id) then
      raise exception 'cannot mark session consented: no consent record stored for session %', new.id;
    end if;
  end if;

  if new.state = 'capturing' then
    if old.state <> 'consented' then
      raise exception 'capture requires consent: invalid transition % -> capturing', old.state;
    end if;
    -- Belt and suspenders: re-verify the consent record itself.
    if not exists (select 1 from consents c where c.session_id = new.id) then
      raise exception 'cannot start capture: no consent record stored for session %', new.id;
    end if;
    if new.started_at is null then
      new.started_at := now();
    end if;
  end if;

  if new.state = 'ended' and new.ended_at is null then
    new.ended_at := now();
  end if;

  return new;
end;
$$;

create trigger session_state_machine
  before insert or update on public.interview_sessions
  for each row execute function public.enforce_session_state();

-- 2. Scores are append-only (PRD 5.6, D11). An audit trail you can edit
--    is not an audit trail. Corrections insert a new row with
--    supersedes_score_id set.
create or replace function public.scores_append_only() returns trigger
language plpgsql
as $$
begin
  raise exception 'scores are append-only; record a correction as a new row with supersedes_score_id';
end;
$$;

create trigger scores_no_update
  before update on public.scores
  for each row execute function public.scores_append_only();
create trigger scores_no_delete
  before delete on public.scores
  for each row execute function public.scores_append_only();

-- Supersede chain integrity: a correction must point at a score on the
-- same response.
create or replace function public.validate_score_supersede() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.supersedes_score_id is not null then
    if not exists (
      select 1 from scores s
      where s.id = new.supersedes_score_id and s.response_id = new.response_id
    ) then
      raise exception 'supersedes_score_id must reference a score on the same response';
    end if;
  end if;
  return new;
end;
$$;

create trigger score_supersede_integrity
  before insert on public.scores
  for each row execute function public.validate_score_supersede();

-- 3. Cached star counts (PRD 5.9). Definer because the starring user
--    has no UPDATE right on the counted qstack.
create or replace function public.maintain_star_count() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update qstacks set star_count = star_count + 1 where id = new.qstack_id;
    return new;
  elsif tg_op = 'DELETE' then
    update qstacks set star_count = greatest(star_count - 1, 0) where id = old.qstack_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger stars_maintain_count
  after insert or delete on public.stars
  for each row execute function public.maintain_star_count();
