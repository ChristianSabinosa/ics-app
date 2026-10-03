-- Minimal profiles migration: table + RLS only.
-- Use this if the full supabase-profiles-schema.sql fails with
-- "permission denied for schema public".
-- Run as the project OWNER in SQL Editor (role: postgres, not anon).
-- Storage bucket + signup trigger are set up via the Dashboard UI instead
-- (see notes at the bottom).

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  middle_name text not null default '',
  last_name text not null default '',
  agency_office text not null default '',
  position text not null default '',
  preferred_ics_position text not null default '',
  availability_status text not null default 'Available'
    check (availability_status in ('Available', 'Deployed/On-Duty', 'Off-Duty/Unavailable')),
  trainings text[] not null default '{}',
  trainings_other text not null default '',
  avatar_url text not null default '',
  deletion_requested boolean not null default false,
  deletion_reason text not null default '',
  deletion_requested_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

alter table profiles enable row level security;

do $$ begin
  create policy "Users can view own profile"
    on profiles for select to authenticated using (auth.uid() = id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can insert own profile"
    on profiles for insert to authenticated with check (auth.uid() = id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can update own profile"
    on profiles for update to authenticated
    using (auth.uid() = id) with check (auth.uid() = id);
exception when duplicate_object then null;
end $$;

create index if not exists profiles_availability_idx on profiles (availability_status);

-- ----------------------------------------------------------------
-- Do the rest in the Dashboard UI (no SQL privileges needed):
-- 1. Storage > New bucket > name "avatars", Public ON, file size 2MB,
--    allowed types image/jpeg, image/png, image/webp.
--    Then Storage > avatars > Policies: public read; authenticated users
--    can insert/update/delete only under their own folder ({user_id}/...).
--    Path convention used by the app: {user_id}/avatar.<ext>
-- 2. Skip the signup trigger (it needs rights on auth.users).
--    The app already upserts the profile row on first save and seeds
--    first/last name from auth metadata, so the trigger is optional.
-- ----------------------------------------------------------------
