-- Argo schema track, migration 0016: deck-owned stars.
-- Design decisions v1.0: a QDeck has its own identity, its own star
-- count, and its own membership list. The gold seal rule is identical
-- for both subjects: 25 or more stars earns the seal. Decks carry the
-- seal and NEVER the fleece edge, so qdecks deliberately has no status
-- field; the fleece edge (in rotation) is a stack-only state.
--
-- Spatial-memory isolation, restating migration 0015's locked rule from
-- the star side: stars never touch canvas position, and canvas position
-- never feeds a star count. No trigger, constraint, or query path may
-- connect stars to canvas_positions in either direction.

alter table public.qdecks
  add column star_count integer not null default 0;

alter table public.stars
  alter column qstack_id drop not null,
  add column deck_id uuid references public.qdecks (id) on delete cascade,
  -- Exactly one subject per star: a stack or a deck.
  add constraint stars_one_subject check (num_nonnulls(qstack_id, deck_id) = 1);

-- Scarcity per subject: the table-level unique constraint is replaced by
-- partial unique indexes because qstack_id is now nullable. One star per
-- user per stack, one star per user per deck; the same user may star
-- both a stack and a deck.
alter table public.stars
  drop constraint stars_user_id_qstack_id_key;
create unique index stars_user_qstack_key
  on public.stars (user_id, qstack_id) where qstack_id is not null;
create unique index stars_user_deck_key
  on public.stars (user_id, deck_id) where deck_id is not null;

create index stars_deck_idx on public.stars (deck_id);

-- Cached counts learn the second subject (replaces the 0008 body).
-- Definer because the starring user has no UPDATE right on the counted
-- row, same reasoning as 0008.
create or replace function public.maintain_star_count() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.qstack_id is not null then
      update qstacks set star_count = star_count + 1 where id = new.qstack_id;
    else
      update qdecks set star_count = star_count + 1 where id = new.deck_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.qstack_id is not null then
      update qstacks set star_count = greatest(star_count - 1, 0) where id = old.qstack_id;
    else
      update qdecks set star_count = greatest(star_count - 1, 0) where id = old.deck_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

-- Starrable if the subject is visible to you; each subquery runs under
-- the subject table's own RLS (qstacks: public/org/own; qdecks: org
-- members only until decks gain a public visibility of their own).
drop policy stars_insert on public.stars;
create policy stars_insert on public.stars
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      (qstack_id is not null
        and exists (select 1 from public.qstacks q where q.id = qstack_id))
      or
      (deck_id is not null
        and exists (select 1 from public.qdecks d where d.id = deck_id))
    )
  );
