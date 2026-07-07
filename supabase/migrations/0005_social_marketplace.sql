-- Argo Goal 1, migration 0005: social layer and marketplace interface.
-- PRD v1.0 Section 6, tables 5, 6, 11, 22.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users (id) on delete cascade,
  -- 280-character cap enforced in schema (PRD decision D17).
  body text not null check (char_length(body) <= 280),
  created_at timestamptz not null default now()
);

create index posts_author_idx on public.posts (author_id);

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.users (id) on delete cascade,
  followee_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id);

create table public.stars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  qstack_id uuid not null references public.qstacks (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, qstack_id)
);

create index stars_qstack_idx on public.stars (qstack_id);

create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  qstack_id uuid not null unique references public.qstacks (id) on delete cascade,
  price_cents integer not null check (price_cents >= 0),
  -- Interface only in v1: no code path can take payment (PRD 5.10, D16).
  status text not null default 'preview_only' check (status in ('preview_only')),
  created_at timestamptz not null default now()
);
