-- ============================================================================
-- In-app notifications
-- Run this once, in the Supabase SQL Editor (after supabase-schema.sql),
-- and BEFORE supabase-leave-schema.sql.
-- ============================================================================

-- 1. Table. incident_id is an informational label, not a live reference: the
--    FK to incidents is dropped below so that hard-deleting an incident cannot
--    take the notification history with it, and so delete_incident() can write
--    its final "this incident was permanently deleted" notice after the
--    incidents row is already gone.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  incident_id text not null references incidents(incident_id),
  recipient_user_id uuid not null references auth.users(id),
  sender_user_id uuid references auth.users(id),
  -- join | imt_join | leave | ic_left | assigned | ic_assigned | role_change | incident_created | incident_deleted | demob_requested | iap_approved | iap_submitted
  type text not null,
  title text not null,
  body text not null default '',
  link text not null default '',
  read_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

-- delete_incident() sweeps every table that has a foreign key to incidents, and
-- that must not take the notification history with it — least of all the final
-- "this incident was permanently deleted" notice, which can only be written
-- after the incident row is gone. incident_id is therefore an informational
-- label rather than a live reference, so the catalog walk skips this table.
alter table notifications drop constraint if exists notifications_incident_id_fkey;

alter table notifications enable row level security;

-- 2. RLS: a user only ever sees their own notifications. There is deliberately
--    NO insert policy — notifications are only ever created by send_notification()
--    below, so nobody can spam arbitrary recipients by writing rows directly.
--    Update/delete are scoped to the recipient so they can clear their own list.
drop policy if exists "Users can view own notifications" on notifications;
create policy "Users can view own notifications"
  on notifications for select
  to authenticated
  using (recipient_user_id = auth.uid());

drop policy if exists "Users can mark own notifications read" on notifications;
create policy "Users can mark own notifications read"
  on notifications for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

drop policy if exists "Users can clear own notifications" on notifications;
create policy "Users can clear own notifications"
  on notifications for delete
  to authenticated
  using (recipient_user_id = auth.uid());

create index if not exists notifications_recipient_idx
  on notifications (recipient_user_id, created_at desc);
create index if not exists notifications_unread_idx
  on notifications (recipient_user_id) where read_at is null;

-- 3. send_notification(): the only way to create notifications.
--
--    SECURITY DEFINER so it is not limited by the absence of an insert policy.
--    It verifies that the CALLER is an active participant of the incident or
--    its creator, and that every recipient is an active participant of the same
--    incident — a signed-in user can therefore never notify anyone outside an
--    incident they belong to.
--
--    The creator branch matters: they own the incident even when they never
--    joined it or have stepped back to Observer, and they are the only person
--    allowed to delete it. Without it the demob gate could block them and then
--    fail to notify the remaining IMTs, which is the whole point of the gate.
--
--    Returns the number of notification rows actually created.
create or replace function public.send_notification(
  p_incident_id text,
  p_type text,
  p_title text,
  p_body text default '',
  p_link text default '',
  p_recipient_ids uuid[] default '{}'::uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_is_participant boolean;
  v_recipients uuid[];
  v_inserted integer := 0;
begin
  if v_sender is null then
    raise exception 'not authenticated';
  end if;

  if p_incident_id is null or p_type is null or p_title is null then
    raise exception 'incident_id, type and title are required';
  end if;

  -- Sender must be an active participant of this incident, or its creator.
  select
    exists (
      select 1 from incident_participants
      where incident_id = p_incident_id
        and user_id = v_sender
        and status = 'Active'
    )
    or exists (
      select 1 from incidents i
      where i.incident_id = p_incident_id
        and i.created_by = v_sender
    )
    into v_is_participant;

  if not v_is_participant then
    raise exception 'only active participants of this incident, or its creator, can send notifications';
  end if;

  -- Recipients are restricted to the active participants of this incident.
  select coalesce(array_agg(distinct p.user_id), '{}'::uuid[])
    into v_recipients
  from incident_participants p
  where p.incident_id = p_incident_id
    and p.user_id = any (p_recipient_ids)
    and p.status = 'Active'
    and p.user_id <> v_sender;

  if coalesce(array_length(v_recipients, 1), 0) = 0 then
    return 0;
  end if;

  insert into notifications
    (incident_id, recipient_user_id, sender_user_id, type, title, body, link)
  select
    p_incident_id, t.recipient_id, v_sender, p_type, p_title, p_body, p_link
  from unnest(v_recipients) as t(recipient_id);

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- Only signed-in users may call it (never the public/anon role).
revoke execute on function public.send_notification(text, text, text, text, text, uuid[]) from public, anon;
grant execute on function public.send_notification(text, text, text, text, text, uuid[]) to authenticated;

-- 3b. send_self_notification(): a confirmation addressed to the caller only.
--
--      send_notification() cannot be reused here: it excludes its own sender
--      (p.user_id <> v_sender) and demands an existing Active participant row,
--      so neither holds for "you just created this incident and have not joined
--      it yet". The only row this can write is recipient = auth.uid(), so there
--      is no way to spam anyone — the sole check is that the caller has a
--      legitimate claim on the incident (they created it, or they are active).
--
--      Returns 1 when written, 0 when the caller has no claim on the incident.
create or replace function public.send_self_notification(
  p_incident_id text,
  p_type text,
  p_title text,
  p_body text default '',
  p_link text default ''
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender uuid := auth.uid();
  v_is_allowed boolean;
begin
  if v_sender is null then
    raise exception 'not authenticated';
  end if;

  if p_incident_id is null or p_type is null or p_title is null then
    raise exception 'incident_id, type and title are required';
  end if;

  select exists (
    select 1 from incidents i
    where i.incident_id = p_incident_id
      and i.created_by = v_sender
  ) or exists (
    select 1 from incident_participants p
    where p.incident_id = p_incident_id
      and p.user_id = v_sender
      and p.status = 'Active'
  ) into v_is_allowed;

  if not v_is_allowed then
    return 0;
  end if;

  insert into notifications
    (incident_id, recipient_user_id, sender_user_id, type, title, body, link)
  values
    (p_incident_id, v_sender, v_sender, p_type, p_title, p_body, p_link);

  return 1;
end;
$$;

revoke execute on function public.send_self_notification(text, text, text, text, text) from public, anon;
grant execute on function public.send_self_notification(text, text, text, text, text) to authenticated;

-- 4. Live delivery: stream INSERTs to the recipient's browser in real time.
--    Wrapped in a DO block so re-running the file is harmless.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
exception
  -- The publication only exists when Realtime is enabled for the project.
  when undefined_object or duplicate_object then null;
end;
$$;
