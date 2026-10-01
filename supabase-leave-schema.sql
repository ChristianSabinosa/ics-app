-- ============================================================================
-- Leaving an incident: multi-instance ICS 221 + hard delete of an incident
-- Run this once, in the Supabase SQL Editor.
-- ============================================================================

-- 1. ICS 221 is now multi-instance (one check-out per released resource), so the
--    list page must be able to delete instances. The original ICS 221 migration
--    only created select/insert/update policies — this adds the missing delete.
drop policy if exists "Authenticated users can delete 221 forms" on ics_221_forms;
create policy "Authenticated users can delete 221 forms"
  on ics_221_forms for delete
  to authenticated
  using (true);

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
create or replace function public.delete_incident(p_incident_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_rec record;
  child_rec  record;
begin
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
end;
$$;

-- Only signed-in users may call it (never the public/anon role).
revoke execute on function public.delete_incident(text) from public, anon;
grant execute on function public.delete_incident(text) to authenticated;
