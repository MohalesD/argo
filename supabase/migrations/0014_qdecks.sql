-- Argo schema track, migration 0014: QDeck, a first-class entity.
-- One-to-many: a stack belongs to at most one deck (nullable FK below;
-- null means loose). Adding a stack that already lives in another deck
-- is a copy at the application layer via the existing clone path, never
-- a shared reference. Removing a stack from a deck sets deck_id null
-- (loose, never deleted). Deleting a deck likewise sets its members
-- loose rather than deleting them.

create table public.qdecks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  owner_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  -- Composite FK target so a stack's deck is org-consistent by
  -- constraint, not by trigger.
  unique (id, org_id)
);

create index qdecks_org_idx on public.qdecks (org_id);

alter table public.qstacks
  add column deck_id uuid,
  -- Composite FK: a stack can only join a deck in its own org. Under
  -- MATCH SIMPLE a null deck_id skips the check, so loose stacks are
  -- unaffected. Column-targeted SET NULL (PG15+) nulls only deck_id on
  -- deck deletion, leaving org_id intact.
  add constraint qstacks_deck_same_org_fkey
    foreign key (deck_id, org_id) references public.qdecks (id, org_id)
    on delete set null (deck_id);

create index qstacks_deck_idx on public.qstacks (deck_id);

alter table public.qdecks enable row level security;

create policy qdecks_select on public.qdecks
  for select to authenticated using (public.is_org_member(org_id));
create policy qdecks_insert on public.qdecks
  for insert to authenticated
  with check (owner_id = auth.uid() and public.is_org_member(org_id));
create policy qdecks_update on public.qdecks
  for update to authenticated
  using (owner_id = auth.uid() or public.is_org_admin(org_id))
  with check (public.is_org_member(org_id));
create policy qdecks_delete on public.qdecks
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_org_admin(org_id));
