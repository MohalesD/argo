-- Argo Goal 1, migration 0003: interviews, sessions, consent, capture,
-- scoring, mentions. PRD v1.0 Section 6, tables 12 to 17.
-- The session state machine and score append-only rules are enforced by
-- triggers in migration 0008.

create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  qstack_id uuid not null references public.qstacks (id) on delete restrict,
  candidate_name text not null,
  candidate_email text,
  role text not null default '',
  scheduled_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'canceled')),
  created_at timestamptz not null default now()
);

create index interviews_org_idx on public.interviews (org_id);

create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  state text not null default 'created'
    check (state in ('created', 'consented', 'capturing', 'ended')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index interview_sessions_interview_idx on public.interview_sessions (interview_id);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  party text not null check (party in ('interviewer', 'candidate', 'other')),
  method text not null default 'verbal_confirmation',
  consented_at timestamptz not null default now(),
  recorded_by uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index consents_session_idx on public.consents (session_id);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  response_text text not null default '',
  starred boolean not null default false,
  highlights jsonb not null default '[]'::jsonb,
  created_by uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index responses_session_idx on public.responses (session_id);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses (id) on delete cascade,
  -- scorer_type 'ai' exists in the schema for future capabilities; no v1
  -- code path writes it (PRD 5.6).
  scorer_type text not null check (scorer_type in ('human', 'ai')),
  scorer_id uuid not null,
  value integer not null check (value between 1 and 4),
  anchor text not null default '',
  rationale text,
  supersedes_score_id uuid references public.scores (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index scores_response_idx on public.scores (response_id);

create table public.mentions (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses (id) on delete cascade,
  mentioned_user_id uuid not null references public.users (id) on delete cascade,
  author_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index mentions_mentioned_idx on public.mentions (mentioned_user_id);
