-- ============================================================================
-- In-app messaging (ICS 213 General Message as the mailbox)
-- Run this once, in the Supabase SQL Editor, AFTER supabase-notifications-schema.sql.
-- ============================================================================

-- 0. Guard. notify_message() below writes into notifications, so running this
--    file first would produce a half-installed messaging system: a working
--    mailbox whose arrival notices silently fail.
do $$
begin
  if to_regclass('public.notifications') is null then
    raise exception
      'STEP 1 HAS NOT BEEN RUN: supabase-notifications-schema.sql created the notifications table. Run that file first, then run this one again.';
  end if;
  if to_regclass('public.incidents') is null then
    raise exception
      'supabase-schema.sql has not been run: messages.incident_id is a foreign key to incidents.';
  end if;
end;
$$;

-- ============================================================================
-- 1. User-created folders
-- ============================================================================

create table if not exists message_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  name text not null,
  created_at timestamp with time zone not null default now(),
  unique (user_id, name)
);

alter table message_folders enable row level security;

drop policy if exists "Users can view own folders" on message_folders;
create policy "Users can view own folders"
  on message_folders for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can create own folders" on message_folders;
create policy "Users can create own folders"
  on message_folders for insert
  to authenticated
  with check (user_id = auth.uid());

-- Rename only: delete goes through delete_my_folder() below, because dropping
-- the row would fire ON DELETE SET NULL against messages, and that UPDATE runs
-- as the caller — which is blocked by the sender-only update policy on
-- messages for every row where the caller is the recipient.
drop policy if exists "Users can rename own folders" on message_folders;
create policy "Users can rename own folders"
  on message_folders for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own folders" on message_folders;
create policy "Users can delete own folders"
  on message_folders for delete
  to authenticated
  using (user_id = auth.uid());

create index if not exists message_folders_user_idx
  on message_folders (user_id, created_at);

-- ============================================================================
-- 2. Messages — the ICS 213 field set plus one mailbox state per side
-- ============================================================================

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),

  -- incident_id IS a live foreign key, unlike notifications: deleting an
  -- incident takes its correspondence with it. delete_incident()'s catalog walk
  -- finds this table, and the self-referential parent_id below lets it delete
  -- replies before the messages they hang off (uuid = uuid, type-safe).
  incident_id text not null references incidents(incident_id),
  incident_name text not null default '',
  parent_id uuid references messages(id) on delete cascade,

  -- From / To. recipient_user_id is what makes this an inbox rather than a
  -- document: it is the account that receives the row once status = 'Sent'.
  sender_user_id uuid not null references auth.users(id),
  sender_name text not null default '',
  sender_position text not null default '',
  recipient_user_id uuid not null references auth.users(id),
  to_name text not null default '',
  to_position text not null default '',

  -- ICS 213 body
  msg_date text not null default '',
  msg_time text not null default '',
  subject text not null default '',
  message text not null default '',
  reply text not null default '',

  -- ICS 213 section 7: Approved by
  approved_by_name text not null default '',
  approved_by_position text not null default '',
  approved_by_sig text not null default '',
  approved_date text not null default '',
  approved_time text not null default '',

  -- ICS 213 section 9: Received by
  received_by_name text not null default '',
  received_by_position text not null default '',
  received_by_sig text not null default '',

  status text not null default 'Draft' check (status in ('Draft', 'Sent')),
  read_at timestamp with time zone,

  sender_box text not null default 'sent' check (sender_box in ('sent', 'archived', 'trashed')),
  recipient_box text not null default 'inbox' check (recipient_box in ('inbox', 'archived', 'trashed')),
  sender_folder_id uuid references message_folders(id) on delete set null,
  recipient_folder_id uuid references message_folders(id) on delete set null,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table messages enable row level security;

-- Read: the sender always sees what they wrote; the recipient only ever sees
-- the row once it has been sent. That single clause is what makes Drafts
-- private without needing a separate message_recipients table — a draft simply
-- does not exist as far as its addressee is concerned.
drop policy if exists "Senders and recipients can read messages" on messages;
create policy "Senders and recipients can read messages"
  on messages for select
  to authenticated
  using (
    sender_user_id = auth.uid()
    or (recipient_user_id = auth.uid() and status = 'Sent')
  );

drop policy if exists "Senders can insert messages" on messages;
create policy "Senders can insert messages"
  on messages for insert
  to authenticated
  with check (sender_user_id = auth.uid());

-- Sender ONLY. The row is shared between two people, so leaving update open to
-- the recipient would let them rewrite the body the sender sees. Everything on
-- the recipient's side (read_at, their box, their folder) goes through the
-- SECURITY DEFINER functions in section 3 instead.
drop policy if exists "Senders can update their messages" on messages;
create policy "Senders can update their messages"
  on messages for update
  to authenticated
  using (sender_user_id = auth.uid())
  with check (sender_user_id = auth.uid());

-- Hard delete is the sender's alone. A recipient who wants a message gone
-- moves it to Trash, which only changes their own view of it.
drop policy if exists "Senders can delete their messages" on messages;
create policy "Senders can delete their messages"
  on messages for delete
  to authenticated
  using (sender_user_id = auth.uid());

create index if not exists messages_recipient_idx
  on messages (recipient_user_id, created_at desc);
create index if not exists messages_sender_idx
  on messages (sender_user_id, created_at desc);
create index if not exists messages_incident_idx
  on messages (incident_id);
create index if not exists messages_parent_idx
  on messages (parent_id);
create index if not exists messages_unread_idx
  on messages (recipient_user_id) where read_at is null;
create index if not exists messages_recipient_inbox_idx
  on messages (recipient_user_id) where read_at is null and status = 'Sent';

-- ============================================================================
-- 3. Recipient-side operations
--
--    Every function here is SECURITY DEFINER because the recipient has no
--    UPDATE policy on messages — see the sender-only policy above. Each one
--    re-checks auth.uid() against the side it is about to touch, so a caller
--    can never reach across to somebody else's copy.
-- ============================================================================

-- Opening a message. Returns true only when it changed something, so the
-- client can tell "already read" apart from "you are not the recipient".
create or replace function public.mark_message_read(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update messages
     set read_at = now(),
         updated_at = now()
   where id = p_message_id
     and recipient_user_id = auth.uid()
     and status = 'Sent'
     and read_at is null;

  return found;
end;
$$;

revoke execute on function public.mark_message_read(uuid) from public, anon;
grant execute on function public.mark_message_read(uuid) to authenticated;

-- Filing a message on one side. p_side decides which copy is touched and the
-- function refuses outright if auth.uid() does not own that side.
--
--   p_side   'sender' | 'recipient'
--   p_box    sender:    'sent' | 'archived' | 'trashed'
--            recipient: 'inbox' | 'archived' | 'trashed'
--   p_folder_id  a folder of the caller's to file it into, or null to leave it
--                in the system box named by p_box. A message is in exactly one
--                place per user, so filing it drops it out of Inbox / Sent.
create or replace function public.move_message(
  p_message_id uuid,
  p_side text,
  p_box text,
  p_folder_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_side not in ('sender', 'recipient') then
    raise exception 'p_side must be sender or recipient';
  end if;

  if p_side = 'sender' and p_box not in ('sent', 'archived', 'trashed') then
    raise exception 'a sender can only move a message between sent, archived and trashed';
  end if;
  if p_side = 'recipient' and p_box not in ('inbox', 'archived', 'trashed') then
    raise exception 'a recipient can only move a message between inbox, archived and trashed';
  end if;

  if p_folder_id is not null then
    perform 1 from message_folders where id = p_folder_id and user_id = auth.uid();
    if not found then
      raise exception 'that folder does not belong to you';
    end if;
  end if;

  if p_side = 'recipient' then
    update messages
       -- Filing into a folder keeps the box untouched: the folder is where the
       -- message lives, and the Inbox query already excludes folder_id <> null.
       set recipient_box = case when p_folder_id is not null then recipient_box else p_box end,
           recipient_folder_id = p_folder_id,
           updated_at = now()
     where id = p_message_id
       and recipient_user_id = auth.uid()
       and status = 'Sent';
  else
    update messages
       set sender_box = case when p_folder_id is not null then sender_box else p_box end,
           sender_folder_id = p_folder_id,
           updated_at = now()
     where id = p_message_id
       and sender_user_id = auth.uid();
  end if;

  return found;
end;
$$;

revoke execute on function public.move_message(uuid, text, text, uuid) from public, anon;
grant execute on function public.move_message(uuid, text, text, uuid) to authenticated;

-- Deleting a folder. The direct DELETE would fire ON DELETE SET NULL across
-- messages, and that internal UPDATE runs as the caller — blocked for every
-- row where the caller is only the recipient. Unfile those rows first, in the
-- same SECURITY DEFINER context.
create or replace function public.delete_my_folder(p_folder_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update messages
     set sender_folder_id = null, updated_at = now()
   where sender_folder_id = p_folder_id
     and sender_user_id = auth.uid();

  update messages
     set recipient_folder_id = null, updated_at = now()
   where recipient_folder_id = p_folder_id
     and recipient_user_id = auth.uid();

  delete from message_folders where id = p_folder_id and user_id = auth.uid();
  return found;
end;
$$;

revoke execute on function public.delete_my_folder(uuid) from public, anon;
grant execute on function public.delete_my_folder(uuid) to authenticated;

-- Arrival notice.
--
-- send_notification() cannot be reused: it only accepts recipients who are
-- Active participants of the incident, and messages may be addressed to any
-- signed-in account. This one authorises against the message itself — the
-- caller must be its sender — so the only row it can write is the notification
-- for that message's own addressee.
--
-- Returns 1 when written, 0 when there is nothing to announce (still a draft,
-- or a message addressed to yourself).
create or replace function public.notify_message(p_message_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_msg messages%rowtype;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;

  select * into v_msg from messages where id = p_message_id;
  if not found then
    raise exception 'message not found';
  end if;
  if v_msg.sender_user_id <> v_caller then
    raise exception 'only the sender of a message may announce it';
  end if;
  if v_msg.status <> 'Sent' or v_msg.recipient_user_id = v_caller then
    return 0;
  end if;

  insert into notifications
    (incident_id, recipient_user_id, sender_user_id, type, title, body, link)
  values
    (
      v_msg.incident_id,
      v_msg.recipient_user_id,
      v_msg.sender_user_id,
      'message',
      'New message: ' || coalesce(nullif(trim(v_msg.subject), ''), 'General Message'),
      coalesce(nullif(trim(v_msg.sender_name), ''), 'Someone') || ' sent you an ICS 213 General Message.',
      '/messages?msg=' || v_msg.id::text
    );

  return 1;
end;
$$;

revoke execute on function public.notify_message(uuid) from public, anon;
grant execute on function public.notify_message(uuid) to authenticated;

-- ICS 213 sections 7 (Approved by), 8 (Reply) and 9 (Received by).
--
-- These three blocks are the only part of the form the RECEIVER of a message
-- is supposed to fill in, but the recipient has no UPDATE policy on messages
-- (see section 2). One SECURITY DEFINER function therefore writes exactly
-- these nine columns, for either side, and never touches the subject or body
-- the sender wrote.
--
-- Returns true when the caller was allowed to sign at all.
create or replace function public.fill_message_sections(
  p_message_id uuid,
  p_approved_by_name text,
  p_approved_by_position text,
  p_approved_by_sig text,
  p_approved_date text,
  p_approved_time text,
  p_reply text,
  p_received_by_name text,
  p_received_by_position text,
  p_received_by_sig text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_msg messages%rowtype;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;

  select * into v_msg from messages where id = p_message_id;
  if not found then
    raise exception 'message not found';
  end if;

  -- Authorise against the message rather than against an incident: the sender,
  -- or the addressee of a message that has actually gone out. Written as one
  -- negated condition so there is no empty branch to terminate.
  if v_msg.sender_user_id <> v_caller
     and (v_msg.recipient_user_id <> v_caller or v_msg.status <> 'Sent') then
    return false;
  end if;

  update messages
     set approved_by_name = p_approved_by_name,
         approved_by_position = p_approved_by_position,
         approved_by_sig = p_approved_by_sig,
         approved_date = p_approved_date,
         approved_time = p_approved_time,
         reply = p_reply,
         received_by_name = p_received_by_name,
         received_by_position = p_received_by_position,
         received_by_sig = p_received_by_sig,
         updated_at = now()
   where id = p_message_id;

  return true;
end;
$$;

revoke execute on function public.fill_message_sections(uuid, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.fill_message_sections(uuid, text, text, text, text, text, text, text, text, text) to authenticated;

-- ============================================================================
-- 4. Live delivery: stream INSERTs and UPDATEs so an open mailbox updates
--    without a reload. Wrapped in a DO block so re-running the file is
--    harmless.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
exception
  -- The publication only exists when Realtime is enabled for the project.
  when undefined_object or duplicate_object then null;
end;
$$;

-- Four new functions were just created, and PostgREST will keep answering
-- "function not found" (HTTP 404) for them until its schema cache reloads —
-- it maps SQLSTATE 42883 to 404, so a stale cache is indistinguishable from a
-- typo in the function name. Best effort: the notification is simply dropped
-- if a reload is already in flight, and Supabase's periodic reload catches up.
notify pgrst, 'reload schema';
