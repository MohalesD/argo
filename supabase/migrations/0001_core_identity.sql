-- Argo Goal 1, migration 0001: core identity.
-- orgs, users (mirroring auth.users), org_members, profiles.
-- PRD v1.0 Section 6, tables 1 to 4.

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  first_name text not null default '',
  created_at timestamptz not null default now()
);

-- New auth signups mirror into public.users. Signup collects first name
-- and email only (PRD 5.1); first_name arrives in raw_user_meta_data.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, email, first_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'first_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index org_members_user_idx on public.org_members (user_id);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  handle text not null unique,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now()
);

-- Org creation is atomic: the org plus its owner membership. Definer so
-- the bootstrap insert does not fight the org_members admin-only policy.
create or replace function public.create_org(p_name text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'create_org requires an authenticated user';
  end if;
  insert into public.orgs (name) values (p_name) returning id into v_org_id;
  insert into public.org_members (org_id, user_id, role)
  values (v_org_id, auth.uid(), 'owner');
  return v_org_id;
end;
$$;
