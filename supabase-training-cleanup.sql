-- ============================================================
-- Training Mode CLEANUP — run BEFORE supabase-training-schema.sql
-- if that script stops with:
--
--   Table public.… already exists with an outdated shape …
--
-- That means an earlier (older or failed) Training Mode attempt left
-- tables behind; `create table if not exists` would skip them and every
-- later statement would fail. This file removes those leftovers:
--
--   1. reports what it found (visible as notices in the SQL Editor),
--   2. drops the six training tables,
--   3. deletes the orphaned child incidents they pointed at — together
--      with everything those incidents own (participants, check-in
--      manifests, ICS forms, resources, maps, IAPs, messages) via a
--      foreign-key catalog walk, because several of those foreign keys
--      are declared WITHOUT on delete cascade.
--
-- Everything else is untouched: regular incidents, accounts, and any
-- older standalone incident whose type merely happens to be 'Training'
-- (those carry no training_id and are not referenced by a stale group).
--
-- Safe to re-run: every step checks first.
-- After this file succeeds, run supabase-training-schema.sql.
-- ============================================================

do $$
declare
  t          text;
  cnt        bigint;
  codes      text[] := '{}';
  inc        text;
  removed    int := 0;
  parent_rec record;
  child_rec  record;
begin
  -- 1) Report what is about to be discarded -------------------------------
  foreach t in array array[
    'trainings','training_groups','training_members',
    'training_guide_progress','training_announcements','training_announcement_reads'
  ] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('select count(*) from public.%I', t) into cnt;
      if cnt > 0 then
        raise notice 'leftover: public.% contains % row(s) — will be dropped', t, cnt;
      end if;
    end if;
  end loop;

  -- 2) Collect the orphaned child incidents -------------------------------
  --    a) the ones the stale groups point at (must be type Training, so a
  --       regular incident can never end up in this list), and
  --    b) any incident carrying a training_id — only Training Mode's own
  --       child incidents ever get one.
  if to_regclass('public.training_groups') is not null then
    select coalesce(array_agg(distinct g.incident_id), '{}')
      into codes
      from public.training_groups g
      join public.incidents i on i.incident_id = g.incident_id
     where i.type = 'Training';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'incidents' and column_name = 'training_id'
  ) then
    codes := codes || (
      select coalesce(array_agg(incident_id), '{}')
        from public.incidents
       where type = 'Training' and training_id is not null
    );
  end if;

  -- 3) Drop the leftovers (the schema script recreates all six) -----------
  drop table if exists public.training_announcement_reads cascade;
  drop table if exists public.training_announcements      cascade;
  drop table if exists public.training_guide_progress     cascade;
  drop table if exists public.training_members            cascade;
  drop table if exists public.training_groups             cascade;
  drop table if exists public.trainings                   cascade;

  -- 4) Delete each orphaned child incident together with everything it
  --    owns. Same two-level catalog walk as public.delete_incident():
  --    first the children of every table that references incidents, then
  --    that table's own row, finally the incidents row itself.
  foreach inc in array codes loop
    if exists (select 1 from public.incidents where incident_id = inc) then
      for parent_rec in
        select c.conrelid::regclass::text as table_name,
               (select a.attname
                  from pg_attribute a
                 where a.attrelid = c.conrelid
                   and a.attnum = c.conkey[1]) as column_name
          from pg_constraint c
         where c.contype = 'f'
           and c.confrelid = 'public.incidents'::regclass
      loop
        for child_rec in
          select gc.conrelid::regclass::text as table_name,
                 (select a.attname
                    from pg_attribute a
                   where a.attrelid = gc.conrelid
                     and a.attnum = gc.conkey[1]) as column_name,
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
            parent_rec.column_name, inc
          );
        end loop;

        execute format(
          'delete from %I where %I = %L',
          parent_rec.table_name, parent_rec.column_name, inc
        );
      end loop;

      delete from public.incidents where incident_id = inc;
      removed := removed + 1;
      raise notice 'removed orphaned training incident %', inc;
    end if;
  end loop;

  raise notice 'Cleanup complete: % orphaned training incident(s) removed.', removed;
  raise notice 'Now run supabase-training-schema.sql.';
end $$;
