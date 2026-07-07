-- Argo Goal 1, migration 0006: model call ledger and eval results.
-- PRD v1.0 Section 6, tables 23 and 24; Section 4.4 enforcement layer 1.

create table public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  purpose text not null,
  -- Hard boundary: production routing is Haiku 4.5 and Sonnet 4.6 only.
  -- Adding a model requires a migration, which is a deliberate human act.
  -- Fable and Mythos strings physically cannot be inserted (PRD 4.4, D5).
  model text not null check (model in ('claude-haiku-4-5', 'claude-sonnet-4-6')),
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index ai_calls_purpose_idx on public.ai_calls (purpose);

create table public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  suite text not null,
  model text,
  passed boolean not null,
  metrics jsonb not null default '{}'::jsonb,
  ran_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index eval_runs_suite_idx on public.eval_runs (suite, ran_at desc);
