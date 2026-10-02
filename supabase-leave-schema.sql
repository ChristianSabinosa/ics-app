-- ============================================================================
-- Leaving an incident: multi-instance ICS 221 + hard delete of an incident
-- Run this ONCE, in the Supabase SQL Editor, AFTER
-- supabase-notifications-schema.sql — that file drops the foreign key from
-- notifications to incidents, which delete_incident() relies on (it writes the
-- final "incident was permanently deleted" notice after the incident row is
-- gone) and without it the function will not even create.
-- ============================================================================

-- 1. ICS 221 is now multi-instance (one check-out per released resource), so the
--    list page must be able to delete instances. The original ICS 221 migration
--    only created select/insert/update policies — this adds the missing delete.
drop policy if exists "Authenticated users can delete 221 forms" on ics_221_forms;
create policy "Authenticated users can delete 221 forms"
  on ics_221_forms for delete
  to authenticated
  using (true);

-- 1b. delete_incident() writes its final "incident was permanently deleted"
--     notice AFTER the incidents row is gone, so notifications must not hold a
--     foreign key to it or that insert would be rejected — and the catalog walk
--     inside the function would otherwise sweep the notification history.
--     Idempotent, so running this file on its own still fixes it.
do $$
begin
  if to_regclass('public.notifications') is null then
    raise exception 'STEP 1 HAS NOT BEEN RUN: supabase-notifications-schema.sql created the notifications table. Run that file FIRST, then run this one again.';
  end if;
  alter table notifications drop constraint if exists notifications_incident_id_fkey;
end $$;

-- 2. delete_incident(): removes an incident together with everything it owns —
--    participants, check-in manifests, every ICS form, the incident map and the
--    Incident Action Plans.
--
--    Written as a SECURITY DEFINER function so it is not limited by the per-table
--    row level security policies (several tables have no delete policy at all, and
--    several foreign keys to incidents are declared WITHOUT on delete cascade).
--
--    It walks the catalog: for every table that references incidents it first
--    removes that table's own children (ics_204_rows, ics_211_resources,
--    checkin_personnel/vehicles/equipment, ics_207_positions, ics_205_channels, ...)
--    and then the incident-scoped rows themselves, finally the incidents row.
--
--    Because SECURITY DEFINER bypasses RLS, the "only the creator may delete"
--    rule has to be enforced inside the function rather than by policy — without
--    it, any signed-in user could wipe any incident by calling this directly.
--
--    notifications carries no foreign key to incidents (see
--    supabase-notifications-schema.sql), so the walk skips it: everyone keeps
--    their history, and a final "this incident was permanently deleted" notice
--    is written afterwards in the same transaction.
create or replace function public.delete_incident(p_incident_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller     uuid := auth.uid();
  v_creator    uuid;
  v_recipients uuid[];
  parent_rec   record;
  child_rec    record;
begin
  if v_caller is null then
    raise exception 'not authenticated';
  end if;

  -- Only the incident's creator may delete it.
  select created_by into v_creator
  from incidents
  where incident_id = p_incident_id;

  if v_creator is null then
    raise exception 'incident not found';
  end if;

  if v_creator is distinct from v_caller then
    raise exception 'only the creator of this incident can delete it';
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
    -- Children of that table first, so no foreign key is left dangling.
    for child_rec in
      select
        gc.conrelid::regclass::text as table_name,
        (select a.attname
           from pg_attribute a
          where a.attrelid = gc.conrelid
            and a.attnum = gc.conkey[1]) as column_name
      from pg_constraint gc
      where gc.contype = 'f'
        and gc.confrelid = parent_rec.table_name::regclass
    loop
      execute format(
        'delete from %I where %I in (select %I from %I where %I = %L)',
        child_rec.table_name, child_rec.column_name,
        parent_rec.column_name, parent_rec.table_name,
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

-- Only signed-in users may call it (never the public/anon role).
revoke execute on function public.delete_incident(text) from public, anon;
grant execute on function public.delete_incident(text) to authenticated;
