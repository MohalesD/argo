-- Argo Goal 1, migration 0004: candidate briefs, tokenized sharing, the
-- PLG invite loop, notifications. PRD v1.0 Section 6, tables 18 to 21.

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  -- content carries per-claim citation response IDs (PRD 5.7).
  content jsonb not null default '{}'::jsonb,
  -- Same allowlist as ai_calls; null when no model generated it.
  generated_by_model text
    check (generated_by_model in ('claude-haiku-4-5', 'claude-sonnet-4-6')),
  status text not null default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz not null default now()
);

create index briefs_interview_idx on public.briefs (interview_id);

create table public.brief_shares (
  id uuid primary key default gen_random_uuid(),
  brief_id uuid not null references public.briefs (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid not null references public.users (id) on delete restrict,
  -- 30-day default expiry, revocable (PRD 5.8, decision D13).
  expires_at timestamptz not null default now() + interval '30 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index brief_shares_brief_idx on public.brief_shares (brief_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.brief_shares (id) on delete cascade,
  accepted_user_id uuid references public.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invites_share_idx on public.invites (share_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, read_at);
