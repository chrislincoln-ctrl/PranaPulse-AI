-- PranaPulse AI — Family Member Profiles & Companion Check-In Schema
-- Run once in the Supabase SQL Editor to persist per-member habits, Telegram bindings,
-- and automated daily brief schedules across deployments.

create extension if not exists pgcrypto;

create table if not exists public.family_member_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  member_key text not null,
  label text not null,
  role text not null,
  mask text not null default 'n95-ffp2',
  daily_outdoor_hours numeric not null default 1.5,
  city text not null default 'New Delhi',
  lat numeric not null default 28.61,
  lon numeric not null default 77.21,
  language text not null default 'en',
  archetype text not null default 'home-caregiver',
  leave_home_time text,
  return_home_time text,
  commute_mode text,
  health_notes text,
  daily_habits_note text,
  telegram_chat_id text unique,
  telegram_link_code text unique,
  telegram_opt_in boolean not null default true,
  brief_time_local text not null default '06:30',
  last_brief_sent_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint family_member_profiles_owner_member_uniq unique (user_id, member_key)
);

create index if not exists idx_family_member_profiles_telegram_chat
  on public.family_member_profiles (telegram_chat_id)
  where telegram_chat_id is not null;

create index if not exists idx_family_member_profiles_link_code
  on public.family_member_profiles (telegram_link_code)
  where telegram_link_code is not null;

create index if not exists idx_family_member_profiles_opt_in
  on public.family_member_profiles (telegram_opt_in)
  where telegram_opt_in = true and telegram_chat_id is not null;

create table if not exists public.companion_checkins (
  id uuid primary key default gen_random_uuid(),
  member_profile_id uuid not null references public.family_member_profiles (id) on delete cascade,
  channel text not null check (channel in ('web', 'telegram')),
  direction text not null check (direction in ('inbound', 'outbound')),
  message_text text not null,
  detected_city text,
  detected_lat numeric,
  detected_lon numeric,
  extracted_habit_note text,
  aqi_snapshot integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_companion_checkins_member_created
  on public.companion_checkins (member_profile_id, created_at desc);

alter table public.family_member_profiles enable row level security;
alter table public.companion_checkins enable row level security;

drop policy if exists "family_member_profiles_select_own" on public.family_member_profiles;
create policy "family_member_profiles_select_own"
  on public.family_member_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "family_member_profiles_insert_own" on public.family_member_profiles;
create policy "family_member_profiles_insert_own"
  on public.family_member_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "family_member_profiles_update_own" on public.family_member_profiles;
create policy "family_member_profiles_update_own"
  on public.family_member_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "family_member_profiles_delete_own" on public.family_member_profiles;
create policy "family_member_profiles_delete_own"
  on public.family_member_profiles
  for delete
  using (auth.uid() = user_id);

drop policy if exists "companion_checkins_select_own" on public.companion_checkins;
create policy "companion_checkins_select_own"
  on public.companion_checkins
  for select
  using (
    exists (
      select 1
      from public.family_member_profiles p
      where p.id = companion_checkins.member_profile_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "companion_checkins_insert_own" on public.companion_checkins;
create policy "companion_checkins_insert_own"
  on public.companion_checkins
  for insert
  with check (
    exists (
      select 1
      from public.family_member_profiles p
      where p.id = companion_checkins.member_profile_id
        and p.user_id = auth.uid()
    )
  );
