-- Argo schema track, migration 0015: canvas spatial memory.
--
-- LOCKED PRODUCT RULE, permanent: canvas position is spatial memory
-- only. Rows in this table must never feed ordering, ranking, sorting,
-- or any scored or assessed output, anywhere in Argo, ever. Where a
-- stack or deck sits on the canvas carries zero meaning about quality,
-- priority, or any person. Intent cannot be a CHECK constraint; this
-- comment is the standing review anchor for any query that touches
-- this table.
--
-- Position rows are durable spatial memory: a stack that joins a deck
-- KEEPS its dormant position row, so when it goes loose again it
-- reappears where it last sat, never at 0,0. If a stack goes loose
-- with no dormant row (created inside a deck, or copied in), the
-- application seeds its new position near the deck it left. That
-- seeding is a UI-track contract; the schema's contribution is that
-- deck membership never deletes or invalidates a position row.

create table public.canvas_positions (
  id uuid primary key default gen_random_uuid(),
  -- Exactly one subject per row: a stack or a deck.
  qstack_id uuid references public.qstacks (id) on delete cascade,
  deck_id uuid references public.qdecks (id) on delete cascade,
  x double precision not null,
  y double precision not null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(qstack_id, deck_id) = 1)
);

comment on table public.canvas_positions is
  'Spatial memory only, permanently. Never feeds ordering, ranking, sorting, or any scored or assessed output.';

-- Org-shared today: one position per subject. Partial unique indexes
-- rather than table constraints so the future per-user move is purely
-- additive: add a nullable user_id, recreate these two indexes with a
-- user_id predicate, keep existing rows as the org-shared baseline.
-- No table rewrite.
create unique index canvas_positions_qstack_key
  on public.canvas_positions (qstack_id) where qstack_id is not null;
create unique index canvas_positions_deck_key
  on public.canvas_positions (deck_id) where deck_id is not null;

alter table public.canvas_positions enable row level security;

-- Org-scoped through the subject's own org, the same derivation
-- pattern qstack_positions uses through kanban_columns. is_org_member
-- on the subject's org (not the subject's SELECT policy) so a public
-- stack's canvas position is still readable and writable only by its
-- own org.
create policy canvas_positions_all on public.canvas_positions
  for all to authenticated
  using (
    (qstack_id is not null and exists (
      select 1 from public.qstacks q
      where q.id = qstack_id and public.is_org_member(q.org_id)))
    or
    (deck_id is not null and exists (
      select 1 from public.qdecks d
      where d.id = deck_id and public.is_org_member(d.org_id)))
  )
  with check (
    (qstack_id is not null and exists (
      select 1 from public.qstacks q
      where q.id = qstack_id and public.is_org_member(q.org_id)))
    or
    (deck_id is not null and exists (
      select 1 from public.qdecks d
      where d.id = deck_id and public.is_org_member(d.org_id)))
  );
