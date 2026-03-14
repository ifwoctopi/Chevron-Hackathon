-- ============================================================
-- Chevron Hack Island — Full Database Schema (flare schema)
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

create schema if not exists flare;

-- IMPORTANT:
-- 1. In Supabase Dashboard -> Project Settings -> API, add `flare` to Exposed schemas.
-- 2. The grants below are required so the authenticated client can query flare via PostgREST.

-- ─────────────────────────────────────────────────────────────
-- 0.  EXTENSIONS
-- ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";  -- gen_random_uuid(), crypt()

-- ─────────────────────────────────────────────────────────────
-- 1.  ENUMS
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create type flare.user_role as enum ('manager', 'engineer');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────
-- 2.  STORAGE BUCKET  (profile photos)
-- ─────────────────────────────────────────────────────────────
-- Create the bucket via the Supabase dashboard (Storage → New bucket)
-- or uncomment the insert below if you prefer SQL.
--
-- insert into storage.buckets (id, name, public)
-- values ('pfp', 'pfp', true)
-- on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 3.  set_updated_at HELPER  (single definition, flare schema)
-- ─────────────────────────────────────────────────────────────
create or replace function flare.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4.  USER_PROFILES  (one row per auth.users row)
-- ─────────────────────────────────────────────────────────────
create table if not exists flare.user_profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  email         text              not null,
  first_name    text              not null,
  last_name     text              not null,
  role          flare.user_role   not null default 'engineer',
  is_active     boolean           not null default false,   -- inactive until manager activates
  home_zone     text,                                        -- set by manager on creation
  profile_photo text,                                        -- storage path: pfp/<user_id>/avatar.*
  created_at    timestamptz       not null default now(),
  updated_at    timestamptz       not null default now()
);

comment on table flare.user_profiles is
  'One row per authenticated user. Mirrors auth.users with role & operational fields.';

drop trigger if exists trg_user_profiles_updated_at on flare.user_profiles;
create trigger trg_user_profiles_updated_at
  before update on flare.user_profiles
  for each row execute procedure flare.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 5.  ENGINEER_PROFILES  (one row per engineer user)
-- ─────────────────────────────────────────────────────────────
create table if not exists flare.engineer_profiles (
  user_id          uuid primary key references flare.user_profiles (user_id) on delete cascade,
  engineer_code    text unique not null,                 -- set explicitly on insert; no volatile default
  home_zone        text,          -- copied from user_profiles; manager sets on creation
  current_location text,          -- engineer updates while on shift
  on_call          boolean     not null default false,
  eta_minutes      int,           -- initial value set by engineer; counts down client-side
  is_active        boolean     not null default false,  -- mirrors user_profiles.is_active
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table flare.engineer_profiles is
  'Operational profile for engineers. is_active mirrors user_profiles for convenience.';

drop trigger if exists trg_engineer_profiles_updated_at on flare.engineer_profiles;
create trigger trg_engineer_profiles_updated_at
  before update on flare.engineer_profiles
  for each row execute procedure flare.set_updated_at();

-- Keep engineer_profiles.is_active in sync with user_profiles.is_active
create or replace function flare.sync_engineer_is_active()
returns trigger language plpgsql security definer as $$
begin
  update flare.engineer_profiles
  set is_active = new.is_active
  where user_id = new.user_id;
  return new;
end $$;

drop trigger if exists trg_sync_engineer_is_active on flare.user_profiles;
create trigger trg_sync_engineer_is_active
  after update of is_active on flare.user_profiles
  for each row execute procedure flare.sync_engineer_is_active();

-- ─────────────────────────────────────────────────────────────
-- 6.  VIEW — available_engineers
--     Pulled directly from engineer_profiles (is_active = true)
-- ─────────────────────────────────────────────────────────────
create or replace view flare.available_engineers as
select
  ep.user_id,
  ep.engineer_code,
  up.first_name,
  up.last_name,
  up.email,
  up.profile_photo,
  ep.home_zone,
  ep.current_location,
  ep.on_call,
  ep.eta_minutes,
  ep.is_active,
  ep.updated_at
from flare.engineer_profiles ep
join flare.user_profiles up on up.user_id = ep.user_id
where ep.is_active = true;

comment on view flare.available_engineers is
  'Live view of all engineers with is_active = true. Powers the Available Engineers tab.';

-- ─────────────────────────────────────────────────────────────
-- 7.  TRIGGER — auto-create user_profiles on auth sign-up
--     Safe enum cast: falls back to 'engineer' on invalid value
-- ─────────────────────────────────────────────────────────────
create or replace function flare.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into flare.user_profiles (user_id, email, first_name, last_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    case
      when new.raw_user_meta_data->>'role' in ('manager', 'engineer')
      then (new.raw_user_meta_data->>'role')::flare.user_role
      else 'engineer'::flare.user_role
    end
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute procedure flare.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 8.  SEED — 5 mock engineers
--
--     Inserts directly into auth.users first so the FK on
--     user_profiles.user_id is satisfied. The handle_new_user
--     trigger will automatically create the user_profiles rows,
--     so we use ON CONFLICT DO NOTHING on those inserts.
--     Passwords are hashed with bcrypt via pgcrypto.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  v_ava   uuid := 'aaaaaaaa-0001-0001-0001-000000000001';
  v_mateo uuid := 'aaaaaaaa-0002-0002-0002-000000000002';
  v_priya uuid := 'aaaaaaaa-0003-0003-0003-000000000003';
  v_jonah uuid := 'aaaaaaaa-0004-0004-0004-000000000004';
  v_lena  uuid := 'aaaaaaaa-0005-0005-0005-000000000005';
begin

  -- ── auth.users (must come first — FK source) ─────────────────
  insert into auth.users
    (id, instance_id, email, encrypted_password, email_confirmed_at,
     raw_user_meta_data, role, aud, created_at, updated_at)
  values
    (v_ava,   '00000000-0000-0000-0000-000000000000', 'ava.tran@hackisland.com',
     crypt('Password123!', gen_salt('bf')), now(),
     '{"first_name":"Ava","last_name":"Tran","role":"engineer"}'::jsonb,
     'authenticated', 'authenticated', now(), now()),

    (v_mateo, '00000000-0000-0000-0000-000000000000', 'mateo.singh@hackisland.com',
     crypt('Password123!', gen_salt('bf')), now(),
     '{"first_name":"Mateo","last_name":"Singh","role":"engineer"}'::jsonb,
     'authenticated', 'authenticated', now(), now()),

    (v_priya, '00000000-0000-0000-0000-000000000000', 'priya.nwosu@hackisland.com',
     crypt('Password123!', gen_salt('bf')), now(),
     '{"first_name":"Priya","last_name":"Nwosu","role":"engineer"}'::jsonb,
     'authenticated', 'authenticated', now(), now()),

    (v_jonah, '00000000-0000-0000-0000-000000000000', 'jonah.reyes@hackisland.com',
     crypt('Password123!', gen_salt('bf')), now(),
     '{"first_name":"Jonah","last_name":"Reyes","role":"engineer"}'::jsonb,
     'authenticated', 'authenticated', now(), now()),

    (v_lena,  '00000000-0000-0000-0000-000000000000', 'lena.okafor@hackisland.com',
     crypt('Password123!', gen_salt('bf')), now(),
     '{"first_name":"Lena","last_name":"Okafor","role":"engineer"}'::jsonb,
     'authenticated', 'authenticated', now(), now())
  on conflict (id) do nothing;

  -- auth.identities rows are required for password grant logins.
  -- If users are seeded only in auth.users, /auth/v1/token can return 500.
  insert into auth.identities
    (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (
      gen_random_uuid(),
      v_ava,
      v_ava::text,
      jsonb_build_object('sub', v_ava::text, 'email', 'ava.tran@hackisland.com'),
      'email',
      now(),
      now(),
      now()
    ),
    (
      gen_random_uuid(),
      v_mateo,
      v_mateo::text,
      jsonb_build_object('sub', v_mateo::text, 'email', 'mateo.singh@hackisland.com'),
      'email',
      now(),
      now(),
      now()
    ),
    (
      gen_random_uuid(),
      v_priya,
      v_priya::text,
      jsonb_build_object('sub', v_priya::text, 'email', 'priya.nwosu@hackisland.com'),
      'email',
      now(),
      now(),
      now()
    ),
    (
      gen_random_uuid(),
      v_jonah,
      v_jonah::text,
      jsonb_build_object('sub', v_jonah::text, 'email', 'jonah.reyes@hackisland.com'),
      'email',
      now(),
      now(),
      now()
    ),
    (
      gen_random_uuid(),
      v_lena,
      v_lena::text,
      jsonb_build_object('sub', v_lena::text, 'email', 'lena.okafor@hackisland.com'),
      'email',
      now(),
      now(),
      now()
    )
  on conflict (provider, provider_id) do nothing;

  -- ── user_profiles ────────────────────────────────────────────
  -- The handle_new_user trigger fires on auth.users insert and
  -- creates the base row. We upsert here to set the extra fields
  -- (is_active, home_zone) that the trigger doesn't know about.
  insert into flare.user_profiles
    (user_id, email, first_name, last_name, role, is_active, home_zone, created_at, updated_at)
  values
    (v_ava,   'ava.tran@hackisland.com',    'Ava',   'Tran',   'engineer', true,  'North Ridge',     now(), now()),
    (v_mateo, 'mateo.singh@hackisland.com', 'Mateo', 'Singh',  'engineer', true,  'Southern Basin',  now(), now()),
    (v_priya, 'priya.nwosu@hackisland.com', 'Priya', 'Nwosu',  'engineer', true,  'Central Plateau', now(), now()),
    (v_jonah, 'jonah.reyes@hackisland.com', 'Jonah', 'Reyes',  'engineer', true,  'Eastern Gate',    now(), now()),
    (v_lena,  'lena.okafor@hackisland.com', 'Lena',  'Okafor', 'engineer', false, 'Western Cliffs',  now(), now())
  on conflict (user_id) do update
    set is_active  = excluded.is_active,
        home_zone  = excluded.home_zone,
        updated_at = now();

  -- ── engineer_profiles ────────────────────────────────────────
  insert into flare.engineer_profiles
    (user_id, engineer_code, home_zone, current_location, on_call, eta_minutes, is_active)
  values
    (v_ava,   'ENG-01', 'North Ridge',     'North Ridge',     true,  null, true),
    (v_mateo, 'ENG-02', 'Southern Basin',  'Southern Basin',  true,  null, true),
    (v_priya, 'ENG-03', 'Central Plateau', 'Central Plateau', true,  null, true),
    (v_jonah, 'ENG-04', 'Eastern Gate',    'Eastern Gate',    true,  null, true),
    (v_lena,  'ENG-05', 'Western Cliffs',  'Western Cliffs',  false, null, false)
  on conflict (user_id) do nothing;

end $$;

-- ─────────────────────────────────────────────────────────────
-- 9.  ROW-LEVEL SECURITY  (RLS)
-- ─────────────────────────────────────────────────────────────

alter table flare.user_profiles     enable row level security;
alter table flare.engineer_profiles enable row level security;

-- Helper: is the calling user a manager?
create or replace function flare.is_manager()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from flare.user_profiles
    where user_id = auth.uid() and role = 'manager'
  );
$$;

-- ── user_profiles policies ────────────────────────────────────

drop policy if exists "authenticated users can read all profiles" on flare.user_profiles;
create policy "authenticated users can read all profiles"
  on flare.user_profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "engineers update own profile" on flare.user_profiles;
create policy "engineers update own profile"
  on flare.user_profiles for update
  using (user_id = auth.uid());

drop policy if exists "managers insert profiles" on flare.user_profiles;
create policy "managers insert profiles"
  on flare.user_profiles for insert
  with check (flare.is_manager());

drop policy if exists "managers update any profile" on flare.user_profiles;
create policy "managers update any profile"
  on flare.user_profiles for update
  using (flare.is_manager());

drop policy if exists "managers delete any profile" on flare.user_profiles;
create policy "managers delete any profile"
  on flare.user_profiles for delete
  using (flare.is_manager());

-- ── engineer_profiles policies ────────────────────────────────

drop policy if exists "authenticated users can read engineer profiles" on flare.engineer_profiles;
create policy "authenticated users can read engineer profiles"
  on flare.engineer_profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "engineers update own engineer profile" on flare.engineer_profiles;
create policy "engineers update own engineer profile"
  on flare.engineer_profiles for update
  using (user_id = auth.uid());

drop policy if exists "managers insert engineer profiles" on flare.engineer_profiles;
create policy "managers insert engineer profiles"
  on flare.engineer_profiles for insert
  with check (flare.is_manager());

drop policy if exists "managers update any engineer profile" on flare.engineer_profiles;
create policy "managers update any engineer profile"
  on flare.engineer_profiles for update
  using (flare.is_manager());

drop policy if exists "managers delete any engineer profile" on flare.engineer_profiles;
create policy "managers delete any engineer profile"
  on flare.engineer_profiles for delete
  using (flare.is_manager());

-- ─────────────────────────────────────────────────────────────
-- 10.  GRANT SELECT on the view to authenticated role
-- ─────────────────────────────────────────────────────────────
grant usage on schema flare to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema flare to authenticated;
grant select on all tables in schema flare to anon;
grant all privileges on all tables in schema flare to service_role;

grant usage, select on all sequences in schema flare to authenticated, service_role;
grant execute on all functions in schema flare to authenticated, service_role;

alter default privileges in schema flare
grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema flare
grant select on tables to anon;

alter default privileges in schema flare
grant all privileges on tables to service_role;

alter default privileges in schema flare
grant usage, select on sequences to authenticated, service_role;

alter default privileges in schema flare
grant execute on functions to authenticated, service_role;

grant select on flare.available_engineers to authenticated;

-- ─────────────────────────────────────────────────────────────
-- END OF SCHEMA
-- ─────────────────────────────────────────────────────────────
