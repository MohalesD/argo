-- Argo Goal 1, migration 0002: the question bank and QStacks.
-- PRD v1.0 Section 6, tables 7 to 11; question fields per 5.3 and 5.4.

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  category text not null check (category in ('motivation', 'culture', 'role', 'skill')),
  -- role_family and level are first-class columns (not provenance keys)
  -- because 5.3 filters retrieval on them; decision D-G1-3.
  role_family text not null,
  level text not null check (level in ('junior', 'mid', 'senior', 'lead')),
  rationale text not null default '',
  provenance jsonb not null default '{}'::jsonb,
  screening_status text not null default 'pending'
    check (screening_status in ('pending', 'passed', 'flagged')),
  -- Author-visible reason when flagged (PRD 5.3); decision D-G1-4.
  flag_reason text,
  -- Badge tier, earned: null until screened; 'verified' reserved for the
  -- future editorial tier (PRD 5.4, decision D14).
  verification text check (verification in ('screened', 'verified')),
  contributed_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index questions_screening_idx on public.questions (screening_status);
create index questions_family_level_idx on public.questions (role_family, level);
create index questions_category_idx on public.questions (category);

create table public.qstacks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  owner_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  role_family text not null default '',
  level text not null default '',
  methodology text not null default '',
  visibility text not null default 'private' check (visibility in ('private', 'org', 'public')),
  forked_from_id uuid references public.qstacks (id) on delete set null,
  star_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index qstacks_org_idx on public.qstacks (org_id);
create index qstacks_visibility_idx on public.qstacks (visibility);

create table public.qstack_items (
  id uuid primary key default gen_random_uuid(),
  qstack_id uuid not null references public.qstacks (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  position integer not null,
  rubric jsonb not null default '{}'::jsonb,
  followups jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (qstack_id, question_id)
);

create index qstack_items_qstack_idx on public.qstack_items (qstack_id, position);

create table public.kanban_columns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  name text not null,
  position integer not null,
  created_at timestamptz not null default now()
);

create index kanban_columns_org_idx on public.kanban_columns (org_id);

create table public.qstack_positions (
  id uuid primary key default gen_random_uuid(),
  qstack_id uuid not null unique references public.qstacks (id) on delete cascade,
  column_id uuid not null references public.kanban_columns (id) on delete cascade,
  position integer not null,
  created_at timestamptz not null default now()
);

create index qstack_positions_column_idx on public.qstack_positions (column_id, position);
