-- ============================================================================
-- System administration — guardrails
--
--   Server-side ENFORCEMENT for the two rules that only a system admin can be
--   subject to:
--
--     E. a system admin has READ-ONLY oversight outside the incidents they
--        created or joined — every write to a form, manifest, map or IAP in
--        somebody else's incident is refused at the database, whatever the
--        screen is showing;
--     A. a suspended account reads and writes nothing at all, even with a
--        perfectly valid access token.
--
--   Run this in the Supabase SQL Editor AFTER supabase-admin-schema.sql
--   (it needs is_system_admin() and is_suspended()).
--
--   HOW IT WORKS
--
--   These are RESTRICTIVE policies (PostgreSQL 15+). Postgres ANDs them with
--   the existing permissive policies instead of OR-ing them, so they can only
--   ever take rights away — and only from the two callers they name. Every
--   expression below short-circuits for everybody else (`not is_system_admin()`
--   / `not is_suspended()`), so no ordinary user's behaviour changes at all.
--
--   A plain permissive policy could not do this: Postgres ORs those together,
--   so granting admins read-only oversight is only expressible as a restriction.
--
--   NOTE ON SELECT
--
--   The read-only guard deliberately does NOT cover SELECT — oversight has to
--   keep working, that is the entire point of authority E — so it is written
--   as three policies (insert / update / delete) rather than `for all`.
--
--   RE-RUN THIS FILE whenever a new table is added: the policies are discovered
--   from the catalog, so a table that does not exist yet has no policy yet.
-- ============================================================================

do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'PostgreSQL 15 or newer is required for RESTRICTIVE policies (this project reports %).', current_setting('server_version');
  end if;
end $$;

-- Dependency check. This file builds on is_system_admin() / is_suspended(),
-- which supabase-admin-schema.sql defines. Running them out of order — or after
-- that file failed part-way — would otherwise surface as a bare 42883 deep in
-- this file instead of an instruction.
do $$
begin
  if to_regprocedure('public.is_system_admin()') is null
     or to_regprocedure('public.is_suspended()') is null then
    raise exception 'supabase-admin-schema.sql has not been applied (or did not finish). Run that file in full first — it must reach its final line without error — then run this file again.';
  end if;
end $$;


-- ============================================================================
-- 1. can_administer(incident_id)
--
--    True for every caller who is not a system admin (the guard is not about
--    them, and returning true keeps their rights exactly as they were).
--    For a system admin it is true only inside an incident they created or
--    joined as an Active participant.
-- ============================================================================

create or replace function public.can_administer(p_incident_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not public.is_system_admin() then true
    when p_incident_id is null then false
    else exists (
      select 1
        from incidents i
       where i.incident_id = p_incident_id
         and (
           i.created_by = auth.uid()
           or exists (
             select 1
               from incident_participants pp
              where pp.incident_id = i.incident_id
                and pp.user_id = auth.uid()
                and pp.status = 'Active'
           )
         )
    )
  end
$$;

revoke execute on function public.can_administer(text) from public, anon;
grant execute on function public.can_administer(text) to authenticated;


-- ============================================================================
-- 2. admin_row_incident() — resolve a row to its incident
--
--    Most writable rows carry `incident_id` themselves, but the child tables do
--    not: ics_211_resources has a form_id, checkin_personnel a manifest_id.
--    This walks foreign keys upward until it reaches a table that does carry
--    the incident id, and returns null when no such path exists.
--
--    SECURITY DEFINER matters twice over: it makes the walk immune to the RLS
--    of every table it reads, and (together with short-circuiting in
--    can_administer_row) it means ordinary users never run it at all — the
--    resolution only happens once per row, and only for a system admin.
-- ============================================================================

create or replace function public.admin_row_incident(
  p_table text,
  p_column text,
  p_value text
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_table        text := p_table;
  v_col          text := p_column;
  v_val          text := p_value;
  v_parent_table text;
  v_parent_col   text;
  v_result       text;
  v_depth        integer := 0;
begin
  if v_val is null then
    return null;
  end if;

  loop
    v_depth := v_depth + 1;
    if v_depth > 6 then
      return null;
    end if;

    -- Reached a table that carries the incident id: read it straight off the
    -- row identified by (v_col = v_val). Works whether v_col IS the incident
    -- id or is a foreign key to the row that has it.
    if exists (
      select 1
        from information_schema.columns ic
       where ic.table_schema = 'public'
         and ic.table_name::text = v_table
         and ic.column_name::text = 'incident_id'
    ) then
      execute format(
        'select incident_id from public.%I where %I::text = $1 limit 1',
        v_table, v_col
      ) into v_result using v_val;
      return v_result;
    end if;

    -- Otherwise follow v_col's foreign key one level up. v_val already IS the
    -- parent's key value, so it travels unchanged.
    select p.relname::text, pa.attname::text
      into v_parent_table, v_parent_col
      from pg_constraint c
      join pg_class ch on ch.oid = c.conrelid
      join pg_namespace cn on cn.oid = ch.relnamespace
      join pg_class p on p.oid = c.confrelid
      join pg_namespace pn on pn.oid = p.relnamespace
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
     where c.contype = 'f'
       and cn.nspname = 'public'
       and ch.relname::text = v_table
       and a.attname::text = v_col
       and pn.nspname = 'public'
     limit 1;

    if v_parent_table is null then
      return null;
    end if;

    v_table := v_parent_table;
    v_col   := v_parent_col;
  end loop;
end;
$$;

-- Called only from can_administer_row(), which is itself SECURITY DEFINER — so
-- this stays private to that chain: it is NOT granted to authenticated, and a
-- direct call from a client fails. Anything it reveals (which incident a row
-- belongs to) would be readable anyway, but there is no reason to offer it.
revoke execute on function public.admin_row_incident(text, text, text) from public, anon, authenticated;

-- The expression actually used in the policies of child tables. It returns true
-- for everyone except a system admin BEFORE it resolves anything, so the walk
-- above costs an ordinary user nothing.
create or replace function public.can_administer_row(
  p_table text,
  p_column text,
  p_value text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_system_admin() then
    return true;
  end if;
  if p_value is null then
    return false;
  end if;
  return public.can_administer(public.admin_row_incident(p_table, p_column, p_value));
end;
$$;

revoke execute on function public.can_administer_row(text, text, text) from public, anon;
grant execute on function public.can_administer_row(text, text, text) to authenticated;


-- ============================================================================
-- 3. The read-only guard (authority E)
--
--    Walks every base table in `public` with RLS enabled and attaches three
--    restrictive policies to it:
--
--      - a table with an `incident_id` column gets can_administer(incident_id);
--      - a child table gets can_administer_row() over the foreign key that
--        leads to its incident (ics_211_resources.form_id, checkin_personnel
--        .manifest_id, ...);
--      - a table with no path to an incident is left alone.
--
--    Deliberately skipped:
--      incidents            admin must be able to close/delete any (authority C)
--      incident_participants admin must be able to enrol anyone     (authority D)
--      notifications        a broadcast has no incident to belong to
--      messages / folders   a personal mailbox, not an incident form
--      profiles, system_admins, admin_audit_log, app_settings   not incident data
--
--    Several tables in the database are not in this repository (the ICS 201-215
--    and 221 tables among them), which is why this is discovered from the
--    catalog rather than listed by hand.
-- ============================================================================

do $$
declare
  v_table    text;
  v_column   text;
  v_parent   text;
  v_skipped  text[] := array[]::text[];
begin
  for v_table in
    select c.relname::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity
       and c.relname not in (
             'profiles', 'system_admins', 'admin_audit_log', 'app_settings',
             'incidents', 'incident_participants', 'notifications',
             'messages', 'message_folders'
           )
     order by c.relname
  loop
    v_column := null;
    v_parent  := null;

    -- (a) the row carries its own incident id
    if exists (
      select 1
        from information_schema.columns ic
       where ic.table_schema = 'public'
         and ic.table_name::text = v_table
         and ic.column_name::text = 'incident_id'
    ) then
      execute format(
        'drop policy if exists "System admin read-only: insert" on public.%I', v_table);
      execute format(
        'create policy "System admin read-only: insert" on public.%I as restrictive for insert to authenticated with check (public.can_administer(incident_id::text))',
        v_table);
      execute format(
        'drop policy if exists "System admin read-only: update" on public.%I', v_table);
      execute format(
        'create policy "System admin read-only: update" on public.%I as restrictive for update to authenticated using (public.can_administer(incident_id::text)) with check (public.can_administer(incident_id::text))',
        v_table);
      execute format(
        'drop policy if exists "System admin read-only: delete" on public.%I', v_table);
      execute format(
        'create policy "System admin read-only: delete" on public.%I as restrictive for delete to authenticated using (public.can_administer(incident_id::text))',
        v_table);
      continue;
    end if;

    -- (b) a foreign key whose parent carries incident_id in its own right
    select a.attname::text, p.relname::text
      into v_column, v_parent
      from pg_constraint c
      join pg_class ch on ch.oid = c.conrelid
      join pg_namespace cn on cn.oid = ch.relnamespace
      join pg_class p on p.oid = c.confrelid
      join pg_namespace pn on pn.oid = p.relnamespace
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and cn.nspname = 'public'
       and ch.relname::text = v_table
       and pn.nspname = 'public'
       and exists (
         select 1
           from information_schema.columns ic
          where ic.table_schema = 'public'
            and ic.table_name::text = p.relname::text
            and ic.column_name::text = 'incident_id'
       )
     limit 1;

    -- (c) otherwise any foreign key into another public table: the resolver
    --     keeps walking until it finds the incident (or runs out).
    if v_column is null then
      select a.attname::text, p.relname::text
        into v_column, v_parent
        from pg_constraint c
        join pg_class ch on ch.oid = c.conrelid
        join pg_namespace cn on cn.oid = ch.relnamespace
        join pg_class p on p.oid = c.confrelid
        join pg_namespace pn on pn.oid = p.relnamespace
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       where c.contype = 'f'
         and cn.nspname = 'public'
         and ch.relname::text = v_table
         and pn.nspname = 'public'
       limit 1;
    end if;

    if v_column is null then
      v_skipped := v_skipped || v_table;
      continue;
    end if;

    execute format(
      'drop policy if exists "System admin read-only: insert" on public.%I', v_table);
    execute format(
      'create policy "System admin read-only: insert" on public.%I as restrictive for insert to authenticated with check (public.can_administer_row(%L, %L, %I::text))',
      v_table, v_table, v_column, v_column);
    execute format(
      'drop policy if exists "System admin read-only: update" on public.%I', v_table);
    execute format(
      'create policy "System admin read-only: update" on public.%I as restrictive for update to authenticated using (public.can_administer_row(%L, %L, %I::text)) with check (public.can_administer_row(%L, %L, %I::text))',
      v_table, v_table, v_column, v_column, v_table, v_column, v_column);
    execute format(
      'drop policy if exists "System admin read-only: delete" on public.%I', v_table);
    execute format(
      'create policy "System admin read-only: delete" on public.%I as restrictive for delete to authenticated using (public.can_administer_row(%L, %L, %I::text))',
      v_table, v_table, v_column, v_column);
  end loop;

  if array_length(v_skipped, 1) > 0 then
    raise notice 'read-only guard not applied (no path to an incident): %', array_to_string(v_skipped, ', ');
  end if;
end $$;


-- ============================================================================
-- 4. Suspension lock-out (authority A)
--
--    Applied to every table with RLS, including the ones skipped above: a
--    suspended account must not even be able to read its own rows. Unlike the
--    guard above this one covers SELECT as well, which is the point of it.
--
--    For everyone else the expression is a constant true, so nothing changes.
-- ============================================================================

do $$
declare
  v_table text;
begin
  for v_table in
    select c.relname::text
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity
     order by c.relname
  loop
    execute format(
      'drop policy if exists "Suspended accounts are locked out" on public.%I', v_table);
    execute format(
      'create policy "Suspended accounts are locked out" on public.%I as restrictive for all to authenticated using (not public.is_suspended()) with check (not public.is_suspended())',
      v_table);
  end loop;
end $$;

-- Avatar uploads live outside the public schema, so they need their own line.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "Suspended accounts are locked out" on storage.objects';
    execute 'create policy "Suspended accounts are locked out" on storage.objects as restrictive for all to authenticated using (not public.is_suspended()) with check (not public.is_suspended())';
  end if;
end $$;


-- ============================================================================
-- 5. How to verify (paste into the SQL Editor, signed in as admin@example.com
--    is NOT required — these are catalog reads):
--
--   -- every table that carries a read-only guard
--   select tablename, policyname, cmd
--     from pg_policies
--    where schemaname = 'public' and policyname like 'System admin read-only%'
--    order by tablename, cmd;
--
--   -- and the lock-out on all of them
--   select count(*) from pg_policies
--    where schemaname = 'public' and policyname = 'Suspended accounts are locked out';
--
--   To see the guard bite: as admin@example.com, open an incident you are not
--   a member of and try to write any form row — the API answers 42501.
-- ============================================================================

notify pgrst, 'reload schema';
