-- Argo Goal 2, migration 0009: full-text search on the question bank
-- (PRD 4.3, 5.3) and the notification writers (PRD 5.5.5, 5.9).
-- Notifications have no INSERT policy for users by design; these
-- definer triggers are the service-side path that creates them.

-- Full-text search over question text and rationale.
alter table public.questions add column fts tsvector
  generated always as (to_tsvector('english', text || ' ' || rationale)) stored;

create index questions_fts_idx on public.questions using gin (fts);

-- 1. @mention -> notify the mentioned org member with deep-link payload
--    (PRD 5.5.5: lands on that exact response).
create or replace function public.notify_mention() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_session uuid;
  v_interview uuid;
  v_author_name text;
begin
  select r.session_id, s.interview_id into v_session, v_interview
  from responses r join interview_sessions s on s.id = r.session_id
  where r.id = new.response_id;
  select first_name into v_author_name from users where id = new.author_id;
  insert into notifications (user_id, type, payload)
  values (new.mentioned_user_id, 'mention', jsonb_build_object(
    'response_id', new.response_id,
    'session_id', v_session,
    'interview_id', v_interview,
    'author_id', new.author_id,
    'author_name', coalesce(v_author_name, '')
  ));
  return new;
end;
$$;

create trigger mentions_notify
  after insert on public.mentions
  for each row execute function public.notify_mention();

-- 2. Publishing a public QStack notifies followers (PRD 5.9).
--    Fires only on the transition into 'public'.
create or replace function public.notify_publish() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.visibility = 'public' and old.visibility <> 'public' then
    insert into notifications (user_id, type, payload)
    select f.follower_id, 'qstack_published', jsonb_build_object(
      'qstack_id', new.id,
      'title', new.title,
      'owner_id', new.owner_id
    )
    from follows f
    where f.followee_id = new.owner_id;
  end if;
  return new;
end;
$$;

create trigger qstacks_notify_publish
  after update on public.qstacks
  for each row execute function public.notify_publish();

-- 3. Contribution credit: a contributed question entering 'passed'
--    notifies its author (PRD 5.9). The permanent attribution line is
--    the contributed_by column itself, rendered wherever the question
--    appears.
create or replace function public.notify_contribution_accepted() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.screening_status = 'passed' and old.screening_status = 'pending'
     and new.contributed_by is not null then
    insert into notifications (user_id, type, payload)
    values (new.contributed_by, 'contribution_accepted', jsonb_build_object(
      'question_id', new.id,
      'question_text', left(new.text, 120)
    ));
  end if;
  return new;
end;
$$;

create trigger questions_notify_contribution
  after update on public.questions
  for each row execute function public.notify_contribution_accepted();
