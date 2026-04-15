-- ═══════════════════════════════════════════════════
-- KlarBrief24 — Supabase Database Schema
-- ═══════════════════════════════════════════════════
-- Ausführen im Supabase SQL Editor:
-- 1. Neues Projekt erstellen auf supabase.com
-- 2. SQL Editor öffnen
-- 3. Diesen gesamten Code einfügen und ausführen
-- ═══════════════════════════════════════════════════

-- ─── PROFILES TABLE ────────────────────────────────
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  vorname text,
  nachname text,
  strasse text,
  plz text,
  ort text,
  telefon text,
  plan text default 'free',
  mollie_customer_id text,
  mollie_subscription_id text,
  subscription_active boolean default false,
  next_payment_date text,
  is_admin boolean default false,
  discount_percent int default 0,
  custom_limit int,
  admin_notes text,
  granted_until text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add columns if upgrading existing schema (safe to run multiple times)
alter table profiles add column if not exists discount_percent int default 0;
alter table profiles add column if not exists custom_limit int;
alter table profiles add column if not exists admin_notes text;
alter table profiles add column if not exists granted_until text;

-- ─── PROJECTS TABLE ────────────────────────────────
create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  category text,
  status text default 'offen',
  ampel text default 'gruen',
  behoerde text,
  frist text,
  aktenzeichen text,
  referenzen jsonb default '[]'::jsonb,
  dokumenttyp text,
  letters jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists projects_user_id_idx on projects(user_id);

-- ─── USAGE TABLE ───────────────────────────────────
create table if not exists usage_tracking (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  month text not null,
  count int default 0,
  created_at timestamptz default now(),
  unique(user_id, month)
);

create index if not exists usage_user_month_idx on usage_tracking(user_id, month);

-- ─── ROW LEVEL SECURITY ────────────────────────────
alter table profiles enable row level security;
alter table projects enable row level security;
alter table usage_tracking enable row level security;

-- ─── HELPER FUNCTION (avoids infinite recursion in admin policies) ──
create or replace function is_admin_user()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

-- PROFILES policies
drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on profiles;
create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on profiles;
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on profiles;
create policy "Admins can view all profiles"
  on profiles for select
  using (is_admin_user());

drop policy if exists "Admins can delete profiles" on profiles;
create policy "Admins can delete profiles"
  on profiles for delete
  using (is_admin_user());

drop policy if exists "Admins can update all profiles" on profiles;
create policy "Admins can update all profiles"
  on profiles for update
  using (is_admin_user());

drop policy if exists "Admins can update all profiles" on profiles;
create policy "Admins can update all profiles"
  on profiles for update
  using (is_admin_user());

-- PROJECTS policies
drop policy if exists "Users can view own projects" on projects;
create policy "Users can view own projects"
  on projects for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own projects" on projects;
create policy "Users can insert own projects"
  on projects for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own projects" on projects;
create policy "Users can update own projects"
  on projects for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own projects" on projects;
create policy "Users can delete own projects"
  on projects for delete
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all projects" on projects;
create policy "Admins can view all projects"
  on projects for select
  using (is_admin_user());

drop policy if exists "Admins can delete all projects" on projects;
create policy "Admins can delete all projects"
  on projects for delete
  using (is_admin_user());

-- USAGE policies
drop policy if exists "Users can view own usage" on usage_tracking;
create policy "Users can view own usage"
  on usage_tracking for select
  using (auth.uid() = user_id);

drop policy if exists "Users can manage own usage" on usage_tracking;
create policy "Users can manage own usage"
  on usage_tracking for all
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all usage" on usage_tracking;
create policy "Admins can view all usage"
  on usage_tracking for select
  using (is_admin_user());

drop policy if exists "Admins can delete all usage" on usage_tracking;
create policy "Admins can delete all usage"
  on usage_tracking for delete
  using (is_admin_user());

-- ─── AUTO-CREATE PROFILE ON SIGNUP ─────────────────
create or replace function handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into profiles (id, email, is_admin)
  values (
    new.id,
    new.email,
    new.email = 'info@csv-support.de'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── AUTO-UPDATE TIMESTAMP ────────────────────────
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on profiles;
create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();
