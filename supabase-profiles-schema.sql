-- ============================================================
-- User Profiles + avatar storage
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

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

-- Auto-create a profile row on signup, seeding names from metadata.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Backfill rows for users created before this migration.
insert into profiles (id, first_name, last_name)
select
  id,
  coalesce(raw_user_meta_data ->> 'first_name', ''),
  coalesce(raw_user_meta_data ->> 'last_name', '')
from auth.users
on conflict (id) do nothing;

-- ============================================================
-- Avatar storage bucket (create via Dashboard > Storage if needed):
--   name: avatars (public)
--   allowed mime types: image/jpeg, image/png, image/webp
--   file size limit: 2MB
--   path convention: {user_id}/avatar.ext
-- ============================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$ begin
  create policy "Public can view avatars"
    on storage.objects for select using (bucket_id = 'avatars');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can upload own avatar"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can update own avatar"
    on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Users can delete own avatar"
    on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null;
end $$;
