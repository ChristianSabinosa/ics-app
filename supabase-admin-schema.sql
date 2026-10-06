-- ============================================================================
-- System administration
--
--   The system admin role, every admin RPC, the audit log, system-wide
--   broadcasts and the reference-data settings table.
--
--   Run this in the Supabase SQL Editor AFTER the other supabase-*.sql files
--   (schema, profiles, notifications, messages, iap, leave), then run
--   supabase-admin-guardrails.sql.
--
--   Every statement here is idempotent, so the file may be re-run at any time
--   and in any order relative to supabase-leave-schema.sql: this file carries
--   its own definition of delete_incident() which is byte-for-byte identical to
--   the one in supabase-leave-schema.sql (see the banner on that function).
--
--   BOOTSTRAP: create admin@example.com first, in
--   Dashboard > Authentication > Users. Section 10 flags that account as the
--   system admin and prints a notice if the account does not exist yet.
-- ============================================================================


-- ============================================================================
-- 1. Suspended flag on profiles
--
--    Suspend is a real server-side lock, not a UI toggle: section 6 attaches a
--    restrictive policy to every table that reads this column, so a suspended
--    account reads and writes nothing at all even with a valid JWT.
-- ============================================================================

alter table profiles add column if not exists suspended boolean not null default false;
alter table profiles add column if not exists suspended_at timestamp with time zone;
alter table profiles add column if not exists suspended_reason text not null default '';


-- ============================================================================
-- 2. system_admins + is_system_admin()
--
--    SECURITY DEFINER is load-bearing, not defensive. A plain policy on this
--    table of the form `using (exists (select 1 from system_admins ...))`
--    would re-enter itself forever: Supabase raises "infinite recursion
--    detected in policy for relation system_admins". Running as the table
--    owner skips RLS for the lookup and breaks the cycle.
--
--    Suspension is folded in here rather than repeated in the eleven RPC
--    guards: every one of them asks this question, so a suspended admin loses
--    them all at once. Otherwise an admin suspended by a colleague could call
--    admin_set_suspended(self, false) and undo the lockout himself. The
--    profiles lookup is definer-owned too, so it cannot recurse either.
-- ============================================================================

create table if not exists system_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamp with time zone not null default now()
);

alter table system_admins enable row level security;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from system_admins where user_id = auth.uid())
         and not coalesce((select p.suspended from profiles p where p.id = auth.uid()), false)
$$;

revoke execute on function public.is_system_admin() from public, anon;
grant execute on function public.is_system_admin() to authenticated;

drop policy if exists "Users can view their own admin flag" on system_admins;
create policy "Users can view their own admin flag"
  on system_admins for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "System admins can view the admin list" on system_admins;
create policy "System admins can view the admin list"
  on system_admins for select to authenticated
  using (public.is_system_admin());


-- ============================================================================
-- 3. is_suspended() / account_status()
--
--    account_status() is what the client asks on start-up: a suspended account
--    cannot even read its own profiles row (section 6 blocks that too), so it
--    could not otherwise discover why the app has gone blank. It is a
--    SECURITY DEFINER so the answer is always readable.
-- ============================================================================

create or replace function public.is_suspended()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.suspended from profiles p where p.id = auth.uid()), false)
$$;

revoke execute on function public.is_suspended() from public, anon;
grant execute on function public.is_suspended() to authenticated;

create or replace function public.account_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_suspended() then 'suspended' else 'active' end
$$;

revoke execute on function public.account_status() from public, anon;
grant execute on function public.account_status() to authenticated;


-- ============================================================================
-- 4. Audit log
--
--    Written ONLY through log_admin_action(): there is deliberately no insert
--    policy, so nobody can fabricate history by writing rows directly.
--
--    target_id is text rather than a foreign key on purpose — the log has to
--    survive the very account deletions it records. actor_email is denormalised
--    for the same reason (the actor row goes away when they sign out of the
--    system for good, but who pressed the button must stay answerable).
-- ============================================================================

create table if not exists admin_audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email   text not null default '',
  action        text not null,
  target_type   text not null default '',
  target_id     text not null default '',
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamp with time zone not null default now()
);

alter table admin_audit_log enable row level security;

drop policy if exists "System admins can read the audit log" on admin_audit_log;
create policy "System admins can read the audit log"
  on admin_audit_log for select to authenticated
  using (public.is_system_admin());

create index if not exists admin_audit_log_created_idx on admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx on admin_audit_log (target_type, target_id);

create or replace function public.log_admin_action(
  p_action text,
  p_target_type text default '',
  p_target_id text default '',
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_id    uuid;
begin
  if v_uid is null or not public.is_system_admin() then
    raise exception 'only a system admin can write to the audit log';
  end if;

  select coalesce(u.email::text, '') into v_email from auth.users u where u.id = v_uid;

  insert into admin_audit_log (actor_user_id, actor_email, action, target_type, target_id, detail)
  values (v_uid, coalesce(v_email, ''), coalesce(p_action, ''), coalesce(p_target_type, ''),
          coalesce(p_target_id, ''), coalesce(p_detail, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.log_admin_action(text, text, text, jsonb) from public, anon;
grant execute on function public.log_admin_action(text, text, text, jsonb) to authenticated;


-- ============================================================================
-- 5. app_settings — reference data shared by every client (authority H)
--
--    Reads are open (every signed-in user needs the option lists); writes are
--    admin-only. The rows are seeded below with the constants the client used
--    to hard-code in src/lib/profile.ts.
-- ============================================================================

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamp with time zone not null default now()
);

alter table app_settings enable row level security;

drop policy if exists "Authenticated users can read settings" on app_settings;
create policy "Authenticated users can read settings"
  on app_settings for select to authenticated
  using (true);

drop policy if exists "System admins can write settings" on app_settings;
create policy "System admins can write settings"
  on app_settings for all to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());


-- ============================================================================
-- 6. Admin policies on existing tables
--
--    Postgres ORs permissive policies together, so each of these only ever
--    ADDS a capability for a system admin. No existing user's rights change.
-- ============================================================================

-- A. read every profile (the user directory behind /admin/users)
drop policy if exists "System admins can view all profiles" on profiles;
create policy "System admins can view all profiles"
  on profiles for select to authenticated
  using (public.is_system_admin());

-- C. update and delete any incident
drop policy if exists "System admins can update any incident" on incidents;
create policy "System admins can update any incident"
  on incidents for update to authenticated
  using (public.is_system_admin())
  with check (true);

drop policy if exists "System admins can delete any incident" on incidents;
create policy "System admins can delete any incident"
  on incidents for delete to authenticated
  using (public.is_system_admin());

-- D. manage any incident's roster. The plain insert policy only ever allowed
--    `with check (auth.uid() = user_id)` (supabase-schema.sql:77), so an admin
--    enrolling somebody else would have been rejected without this one.
drop policy if exists "System admins can manage participants" on incident_participants;
create policy "System admins can manage participants"
  on incident_participants for all to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());


-- ============================================================================
-- 7. admin_list_users()
--
--    PostgREST only exposes the `public` schema, so auth.users (email, last
--    sign-in, confirmation state) is unreachable from the client. This joins it
--    to profiles and system_admins server-side and returns the whole directory
--    in one call.
--
--    The guard is inside the function, not just in the UI: without it the
--    SECURITY DEFINER body would hand every signed-in account the complete
--    user directory, because the definition reads straight past row level
--    security.
-- ============================================================================

create or replace function public.admin_list_users()
returns table (
  id                    uuid,
  email                 text,
  first_name            text,
  last_name             text,
  agency_office         text,
  -- POSITION is a SQL keyword; quoted so the column keeps the name the
  -- client reads (AdminUser.position) without the parser tripping over it.
  "position"            text,
  availability_status   text,
  avatar_url            text,
  suspended             boolean,
  suspended_reason      text,
  deletion_requested    boolean,
  deletion_reason       text,
  deletion_requested_at timestamp with time zone,
  is_system_admin       boolean,
  created_at            timestamp with time zone,
  last_sign_in_at       timestamp with time zone,
  email_confirmed_at    timestamp with time zone
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_system_admin() then
    raise exception 'only a system admin can list accounts';
  end if;

  -- Every column is qualified on purpose: in plpgsql the OUT parameters above
  -- are variables, and an unqualified reference would be ambiguous.
  return query
  select
    u.id,
    coalesce(u.email::text, ''),
    coalesce(p.first_name, ''),
    coalesce(p.last_name, ''),
    coalesce(p.agency_office, ''),
    coalesce(p."position", ''),
    coalesce(p.availability_status, ''),
    coalesce(p.avatar_url, ''),
    coalesce(p.suspended, false),
    coalesce(p.suspended_reason, ''),
    coalesce(p.deletion_requested, false),
    coalesce(p.deletion_reason, ''),
    p.deletion_requested_at,
    exists (select 1 from system_admins s where s.user_id = u.id),
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at
  from auth.users u
  left join profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;


-- ============================================================================
-- 8. Admin RPCs
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. suspend / restore
--
--    Session revocation is best effort and never fatal: RLS already denies a
--    suspended account every table, so a leftover access token (max 1 hour)
--    can read nothing. If the database role may not touch auth.sessions the
--    notice below says so and the rest of the operation stands.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_suspended(
  p_user_id uuid,
  p_suspended boolean,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_email  text;
begin
  if v_caller is null or not public.is_system_admin() then
    raise exception 'only a system admin can change an account status';
  end if;
  if p_user_id is null then
    raise exception 'user id is required';
  end if;
  if p_user_id = v_caller and p_suspended then
    raise exception 'you cannot suspend your own account';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user not found';
  end if;

  -- An account created straight in the dashboard never fires the signup
  -- trigger, so it can have no profile row yet: create it rather than failing.
  insert into profiles (id) values (p_user_id)
  on conflict (id) do nothing;

  update profiles
     set suspended = p_suspended,
         suspended_at = case when p_suspended then now() else null end,
         suspended_reason = case when p_suspended then coalesce(p_reason, '') else '' end,
         updated_at = now()
   where id = p_user_id;

  if not found then
    raise exception 'user not found — the profile row is missing for that account';
  end if;

  select coalesce(u.email::text, '') into v_email from auth.users u where u.id = p_user_id;

  if p_suspended then
    begin
      delete from auth.refresh_tokens where user_id = p_user_id;
      delete from auth.sessions where user_id = p_user_id;
    exception when others then
      raise notice 'session revocation skipped: %', sqlerrm;
    end;
  end if;

  perform public.log_admin_action(
    case when p_suspended then 'user_suspended' else 'user_restored' end,
    'user', p_user_id::text,
    jsonb_build_object('email', coalesce(v_email, ''), 'reason', coalesce(p_reason, ''))
  );
end;
$$;

revoke execute on function public.admin_set_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- B. grant / revoke the system admin flag
--
--    The last admin can never be removed: without one there would be no way
--    back into /admin, and no account left that could nominate a successor.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_system_admin(p_user_id uuid, p_grant boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_email  text;
  v_count  integer;
begin
  if v_caller is null or not public.is_system_admin() then
    raise exception 'only a system admin can change the system admin list';
  end if;
  if p_user_id is null then
    raise exception 'user id is required';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user not found';
  end if;
  select coalesce(u.email::text, '') into v_email from auth.users u where u.id = p_user_id;

  if not p_grant then
    select count(*) into v_count from system_admins;
    if v_count <= 1 then
      raise exception 'the last system admin cannot be removed';
    end if;
    delete from system_admins where user_id = p_user_id;
    if not found then
      raise exception 'that account is not a system admin';
    end if;
  else
    if exists (select 1 from system_admins where user_id = p_user_id) then
      return; -- already flagged, nothing to do and nothing to audit
    end if;
    insert into system_admins (user_id, granted_by) values (p_user_id, v_caller);
  end if;

  perform public.log_admin_action(
    case when p_grant then 'admin_granted' else 'admin_revoked' end,
    'user', p_user_id::text,
    jsonb_build_object('email', coalesce(v_email, ''))
  );
end;
$$;

revoke execute on function public.admin_set_system_admin(uuid, boolean) from public, anon;
grant execute on function public.admin_set_system_admin(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- A. decline a deletion request (the user keeps their account)
-- ---------------------------------------------------------------------------
create or replace function public.admin_clear_deletion_request(
  p_user_id uuid,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_email  text;
begin
  if v_caller is null or not public.is_system_admin() then
    raise exception 'only a system admin can act on a deletion request';
  end if;
  if p_user_id is null then
    raise exception 'user id is required';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user not found';
  end if;

  -- See admin_set_suspended(): dashboard-created accounts may have no row yet.
  insert into profiles (id) values (p_user_id)
  on conflict (id) do nothing;

  update profiles
     set deletion_requested = false,
         deletion_reason = '',
         deletion_requested_at = null,
         updated_at = now()
   where id = p_user_id;

  if not found then
    raise exception 'user not found — the profile row is missing for that account';
  end if;

  select coalesce(u.email::text, '') into v_email from auth.users u where u.id = p_user_id;

  perform public.log_admin_action(
    'deletion_request_declined', 'user', p_user_id::text,
    jsonb_build_object('email', coalesce(v_email, ''), 'note', coalesce(p_note, ''))
  );
end;
$$;

revoke execute on function public.admin_clear_deletion_request(uuid, text) from public, anon;
grant execute on function public.admin_clear_deletion_request(uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- A. full-cascade account deletion
--
--    Step 1 runs the same delete_incident() sweep a creator would trigger from
--    Ongoing Incidents, for every incident this account owns — that clears the
--    forms, manifests and rosters hanging off them.
--
--    Step 2 walks pg_constraint instead of a hard-coded table list. Several
--    tables exist in the database that are NOT in this repository, and an
--    unknown foreign key to auth.users would make the final delete fail and
--    roll the whole operation back. Incidents are excluded from the sweep on
--    purpose and asserted empty instead: a bare delete there would trip the
--    foreign keys held by their child tables.
--
--    Step 3 deletes the account itself (profiles and system_admins cascade).
-- ---------------------------------------------------------------------------
create or replace function public.admin_sweep_user_refs(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_con   record;
  v_count integer;
  v_total jsonb := '{}'::jsonb;
begin
  -- This function deletes rows from arbitrary tables on behalf of the caller;
  -- without the guard it would be a privilege escalation, not a helper.
  if auth.uid() is null or not public.is_system_admin() then
    raise exception 'only a system admin can delete an account''s data';
  end if;

  for v_con in
    select child.relname::text as table_name,
           a.attname::text as column_name
      from pg_constraint c
      join pg_class child on child.oid = c.conrelid
      join pg_namespace cn on cn.oid = child.relnamespace
      join pg_class parent on parent.oid = c.confrelid
      join pg_namespace pn on pn.oid = parent.relnamespace
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and pn.nspname = 'auth'
       and parent.relname = 'users'
       and cn.nspname = 'public'
       -- profiles / system_admins cascade with the account, admin_audit_log
       -- nulls out, incidents is asserted empty by the caller, and anything
       -- with ON DELETE CASCADE or SET NULL needs no help from us.
       and child.relname <> 'profiles'
       and child.relname <> 'system_admins'
       and child.relname::text <> all (array['admin_audit_log', 'incidents'])
       and c.confdeltype not in ('c', 'n')
     order by child.relname
  loop
    execute format('delete from public.%I where %I = $1', v_con.table_name, v_con.column_name)
      using p_user_id;
    get diagnostics v_count = row_count;
    if v_count > 0 then
      v_total := v_total || jsonb_build_object(v_con.table_name, v_count);
    end if;
  end loop;

  return v_total;
end;
$$;

revoke execute on function public.admin_sweep_user_refs(uuid) from public, anon;
grant execute on function public.admin_sweep_user_refs(uuid) to authenticated;

create or replace function public.admin_finalize_account_deletion(
  p_user_id uuid,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller   uuid := auth.uid();
  v_email    text;
  v_is_admin boolean;
  v_admins   integer;
  v_detail   jsonb := '{}'::jsonb;
  v_count    integer := 0;
  v_row      record;
  v_reason   text := '';
begin
  if v_caller is null or not public.is_system_admin() then
    raise exception 'only a system admin can delete an account';
  end if;
  if p_user_id is null then
    raise exception 'user id is required';
  end if;
  if p_user_id = v_caller then
    raise exception 'you cannot delete your own account';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user not found';
  end if;
  select coalesce(u.email::text, '') into v_email from auth.users u where u.id = p_user_id;
  -- Read while the account still exists: the reason the user gave when they
  -- flagged themselves for deletion.
  select coalesce(p.deletion_reason, '') into v_reason from profiles p where p.id = p_user_id;

  select exists (select 1 from system_admins where user_id = p_user_id) into v_is_admin;
  if v_is_admin then
    select count(*) into v_admins from system_admins;
    if v_admins <= 1 then
      raise exception 'the last system admin cannot be deleted';
    end if;
  end if;

  -- 1. every incident this account created, swept exactly like a creator
  --    deleting it (delete_incident allows a system admin since section 9).
  for v_row in select i.incident_id from incidents i where i.created_by = p_user_id loop
    perform public.delete_incident(v_row.incident_id);
    v_count := v_count + 1;
  end loop;
  v_detail := v_detail || jsonb_build_object('incidents_deleted', v_count);

  if exists (select 1 from incidents where created_by = p_user_id) then
    raise exception 'incidents still reference this account — nothing was deleted';
  end if;

  -- 2. whatever still points at them elsewhere.
  v_detail := v_detail || jsonb_build_object('rows_deleted', public.admin_sweep_user_refs(p_user_id));

  -- 3. the account itself.
  begin
    delete from auth.users where id = p_user_id;
  exception
    when insufficient_privilege then
      raise exception 'the database role may not delete from auth.users. Run in the SQL Editor: grant delete on table auth.users to postgres; then retry — nothing was deleted.';
    when foreign_key_violation then
      raise exception 'data still references this account (%). Nothing was deleted.', sqlerrm;
  end;

  if not found then
    raise exception 'account could not be removed from auth.users — nothing was deleted';
  end if;

  v_detail := v_detail || jsonb_build_object(
    'email', coalesce(v_email, ''),
    'note', coalesce(p_note, ''),
    'deletion_reason', coalesce(v_reason, '')
  );

  perform public.log_admin_action('user_deleted', 'user', p_user_id::text, v_detail);

  return v_detail;
end;
$$;

revoke execute on function public.admin_finalize_account_deletion(uuid, text) from public, anon;
grant execute on function public.admin_finalize_account_deletion(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- D. add / re-role / remove a participant in any incident
--
--    Mirrors how the incident page changes a role (deactivate the current row,
--    insert a fresh one with a new role id) so history stays intact and
--    `role_id` stays unique, and it tells the affected account what happened.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_participant(
  p_incident_id text,
  p_user_id uuid,
  p_role text,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller  uuid := auth.uid();
  v_email   text;
  v_name    text;
  v_role_id text;
  v_tries   integer := 0;
begin
  if v_caller is null or not public.is_system_admin() then
    raise exception 'only a system admin can manage participants';
  end if;
  if p_incident_id is null or p_user_id is null then
    raise exception 'incident and user are required';
  end if;
  if coalesce(p_role, '') not in ('IMT', 'Tactical Resources', 'Observer') then
    raise exception 'unknown role: %', coalesce(p_role, '(null)');
  end if;
  if coalesce(p_action, '') not in ('set', 'remove') then
    raise exception 'unknown action: %', coalesce(p_action, '(null)');
  end if;
  if not exists (select 1 from incidents where incident_id = p_incident_id) then
    raise exception 'incident not found';
  end if;

  select coalesce(u.email::text, '') into v_email from auth.users u where u.id = p_user_id;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'user not found';
  end if;

  if p_action = 'remove' then
    update incident_participants
       set status = 'Left', left_at = now()
     where incident_id = p_incident_id and user_id = p_user_id and status = 'Active';
    if not found then
      raise exception 'that account is not an active participant of this incident';
    end if;

    insert into notifications (incident_id, recipient_user_id, sender_user_id, type, title, body, link)
    values (p_incident_id, p_user_id, v_caller, 'role_change',
            'You were removed from ' || p_incident_id,
            'A system administrator removed you from this incident.',
            '/incident/' || p_incident_id);

    perform public.log_admin_action('participant_removed', 'incident', p_incident_id,
      jsonb_build_object('user_id', p_user_id, 'email', coalesce(v_email, '')));
    return;
  end if;

  select coalesce(trim(p2.first_name || ' ' || p2.last_name), '') into v_name
    from profiles p2 where p2.id = p_user_id;
  if v_name is null or v_name = '' then
    v_name := coalesce(nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'User');
  end if;

  -- Deactivate whatever they hold now, then insert the fresh row — the same
  -- two-step the incident page performs when a member switches role.
  update incident_participants
     set status = 'Left', left_at = now()
   where incident_id = p_incident_id and user_id = p_user_id and status = 'Active';

  loop
    v_tries := v_tries + 1;
    v_role_id :=
      (case p_role when 'IMT' then 'IMT' when 'Tactical Resources' then 'TAC' else 'OBS' end)
      || '-' || to_char(now(), 'YYYYMMDD')
      || '-' || lpad((floor(random() * 900) + 100)::text, 3, '0');
    begin
      insert into incident_participants (incident_id, user_id, user_name, user_email, role, role_id, status)
      values (p_incident_id, p_user_id, v_name, coalesce(v_email, ''), p_role, v_role_id, 'Active');
      exit;
    exception when unique_violation then
      if v_tries >= 5 then raise; end if;
    end;
  end loop;

  insert into notifications (incident_id, recipient_user_id, sender_user_id, type, title, body, link)
  values (p_incident_id, p_user_id, v_caller, 'role_change',
          'Your role in ' || p_incident_id || ' is now ' || p_role,
          'A system administrator changed your assignment.', '/incident/' || p_incident_id);

  perform public.log_admin_action('participant_set', 'incident', p_incident_id,
    jsonb_build_object('user_id', p_user_id, 'email', coalesce(v_email, ''), 'role', p_role));
end;
$$;

revoke execute on function public.admin_set_participant(text, uuid, text, text) from public, anon;
grant execute on function public.admin_set_participant(text, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- C. open / close an incident on somebody else's behalf
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_incident_status(p_incident_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_system_admin() then
    raise exception 'only a system admin can change an incident status';
  end if;
  if coalesce(p_status, '') not in ('Ongoing', 'Closed') then
    raise exception 'unknown status: %', coalesce(p_status, '(null)');
  end if;

  update incidents set status = p_status, updated_at = now() where incident_id = p_incident_id;
  if not found then
    raise exception 'incident not found';
  end if;

  perform public.log_admin_action('incident_status_changed', 'incident', p_incident_id,
    jsonb_build_object('status', p_status));
end;
$$;

revoke execute on function public.admin_set_incident_status(text, text) from public, anon;
grant execute on function public.admin_set_incident_status(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- C. delete any incident (delegates the sweep, adds the audit entry)
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_incident(p_incident_id text, p_note text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_system_admin() then
    raise exception 'only a system admin can delete an incident';
  end if;
  if p_incident_id is null then
    raise exception 'incident id is required';
  end if;

  perform public.delete_incident(p_incident_id);

  perform public.log_admin_action('incident_deleted', 'incident', p_incident_id,
    jsonb_build_object('note', coalesce(p_note, '')));
end;
$$;

revoke execute on function public.admin_delete_incident(text, text) from public, anon;
grant execute on function public.admin_delete_incident(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- F. system-wide broadcast
--
--    notifications.incident_id is NOT NULL but its foreign key to incidents was
--    dropped (supabase-notifications-schema.sql:31), so 'SYSTEM' is a legal
--    sentinel: nothing joins on it and the client only ever links when `link`
--    is non-empty, which keeps a broadcast inert until it is clicked.
-- ---------------------------------------------------------------------------
create or replace function public.send_broadcast(
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
  v_count integer;
begin
  if auth.uid() is null or not public.is_system_admin() then
    raise exception 'only a system admin can send a broadcast';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'a title is required';
  end if;

  insert into notifications (incident_id, recipient_user_id, sender_user_id, type, title, body, link)
  select 'SYSTEM', u.id, auth.uid(), 'broadcast', trim(p_title), coalesce(p_body, ''), coalesce(p_link, '')
  from auth.users u
  left join profiles p on p.id = u.id
  where coalesce(p.suspended, false) = false;

  get diagnostics v_count = row_count;

  perform public.log_admin_action('broadcast_sent', 'notification', '',
    jsonb_build_object('title', trim(p_title), 'recipients', v_count));

  return v_count;
end;
$$;

revoke execute on function public.send_broadcast(text, text, text) from public, anon;
grant execute on function public.send_broadcast(text, text, text) to authenticated;


-- ============================================================================
-- 9. delete_incident() — admin branch
--
--    KEEP IN SYNC WITH supabase-leave-schema.sql. The two definitions are
--    identical on purpose so that the order the files are run in never
--    matters: whichever runs last wins, and both say the same thing.
--
--    The ONLY difference from the original is the authorization check below:
--    the creator, or any system admin, may delete. Everything else — the
--    catalog walk, the recipient sweep, the final notice — is untouched.
--
--    The original wording ("only the creator ...") is kept as a prefix of the
--    new message because src/lib/leaveIncident.ts:43 matches on that substring
--    to show a friendly error.
-- ============================================================================

create or replace function public.delete_incident(p_incident_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller     uuid := auth.uid();
  v_creator    uuid;
  v_is_admin   boolean := false;
  v_recipients uuid[];
  parent_rec   record;
  child_rec    record;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;

  -- The incident's creator, or a system admin.
  -- KEEP IN SYNC: defined identically in supabase-leave-schema.sql and
  -- supabase-admin-schema.sql, so either of those files may be run last.
  select created_by into v_creator
  from incidents
  where incident_id = p_incident_id;

  if v_creator is null then
    raise exception 'incident not found';
  end if;

  -- The system-admin branch only exists once supabase-admin-schema.sql has been
  -- installed. Until then there is no such concept, so the lookup is skipped
  -- instead of every delete failing on a missing function.
  if v_creator is distinct from v_caller then
    if to_regprocedure('public.is_system_admin()') is not null then
      execute 'select public.is_system_admin()' into v_is_admin;
    end if;
    if not v_is_admin then
      raise exception 'only the creator of this incident or a system admin can delete it';
    end if;
  end if;

  -- Everyone who is about to lose access, captured before the sweep empties
  -- the roster.
  select coalesce(array_agg(distinct p.user_id), '{}'::uuid[])
    into v_recipients
  from incident_participants p
  where p.incident_id = p_incident_id
    and p.status = 'Active';

  for parent_rec in
    select
      c.conrelid::regclass::text as table_name,
      (select a.attname
         from pg_attribute a
        where a.attrelid = c.conrelid
          and a.attnum = c.conkey[1]) as column_name
    from pg_constraint c
    where c.contype = 'f'
      and c.confrelid = 'incidents'::regclass
  loop
    -- Tables that reference THIS one, cleared first so no foreign key is left
    -- dangling (confrelid = what the constraint points at).
    for child_rec in
      select
        gc.conrelid::regclass::text as table_name,
        (select a.attname
           from pg_attribute a
          where a.attrelid = gc.conrelid
            and a.attnum = gc.conkey[1]) as column_name,
        -- The column on THIS table that the child's foreign key points at.
        -- Without it the subquery selected the wrong column and paired
        -- incompatible types, e.g.
        --   delete from ics_211_resources
        --   where form_id (uuid) in (select incident_id (text) from ics_211_forms ...)
        -- which raises "operator does not exist: uuid = text". PostgREST maps
        -- that SQLSTATE 42883 to HTTP 404, so it looked like a missing function.
        (select a.attname
           from pg_attribute a
          where a.attrelid = gc.confrelid
            and a.attnum = gc.confkey[1]) as parent_key
      from pg_constraint gc
      where gc.contype = 'f'
        and gc.confrelid = parent_rec.table_name::regclass
    loop
      execute format(
        'delete from %I where %I in (select %I from %I where %I = %L)',
        child_rec.table_name, child_rec.column_name,
        child_rec.parent_key, parent_rec.table_name,
        parent_rec.column_name, p_incident_id
      );
    end loop;

    execute format(
      'delete from %I where %I = %L',
      parent_rec.table_name, parent_rec.column_name, p_incident_id
    );
  end loop;

  delete from incidents where incident_id = p_incident_id;

  -- Tell everyone who was still in it that the incident is gone for good.
  -- Written after the sweep but in the same transaction; there is no link left
  -- to point at, and notifications are no longer tied to the incidents row so
  -- nothing here can be swept away again.
  insert into notifications
    (incident_id, recipient_user_id, sender_user_id, type, title, body, link)
  select
    p_incident_id, t.recipient_id, v_caller, 'incident_deleted',
    'Incident ' || p_incident_id || ' was permanently deleted',
    'All forms, check-in manifests and participant records for this incident have been removed.',
    ''
  from unnest(v_recipients) as t(recipient_id);
end;
$$;

revoke execute on function public.delete_incident(text) from public, anon;
grant execute on function public.delete_incident(text) to authenticated;


-- ============================================================================
-- 10. Reference data + bootstrap
-- ============================================================================

insert into app_settings (key, value)
values
  ('ics_positions', '["Incident Commander","Deputy Incident Commander","Operations Section Chief","Planning Section Chief","Logistics Section Chief","Finance/Admin Section Chief","Command Staff (PIO / Safety / Liaison)","EOC Staff","Field Responder","Other"]'::jsonb),
  ('trainings', '["Incident Command System Executive Course","Emergency Operations Center Executive Course","Basic Incident Command System","Integrated Planning on Incident Command System","Position Courses on Incident Command System","All-Hazard Incident Management Team","Emergency Operations Center Training","Training for Instructors"]'::jsonb),
  ('agencies', '[]'::jsonb)
on conflict (key) do nothing;

-- A profile row exists for anyone who signed up through the client (the trigger
-- in supabase-profiles-schema.sql). An account created directly in the
-- dashboard never fires that trigger and would have no row to suspend, to list
-- or to decline a deletion request for, so every account missing one is
-- backfilled here. Every column has a default, so an empty row is exactly what
-- the trigger would have written.
insert into profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;

insert into system_admins (user_id, granted_by)
select u.id, u.id
  from auth.users u
 where lower(u.email) = 'admin@example.com'
 on conflict (user_id) do nothing;

do $$
begin
  if not exists (select 1 from auth.users where lower(email) = 'admin@example.com') then
    raise notice 'admin@example.com does not exist yet. Create it in Dashboard > Authentication > Users, then re-run this file to flag it as the system admin.';
  elsif exists (select 1 from system_admins s join auth.users u on u.id = s.user_id where lower(u.email) = 'admin@example.com') then
    raise notice 'admin@example.com is flagged as a system admin.';
  end if;
end $$;


-- PostgREST caches the function list; without this the new RPCs answer
-- "Could not find the function" until the next automatic reload.
notify pgrst, 'reload schema';
