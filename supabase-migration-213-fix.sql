-- ICS 213 - Add missing columns

alter table ics_213_forms add column if not exists approved_by_position text not null default '';
alter table ics_213_forms add column if not exists reply text not null default '';
alter table ics_213_forms add column if not exists received_by_name text not null default '';
alter table ics_213_forms add column if not exists received_by_position text not null default '';
alter table ics_213_forms add column if not exists received_by_sig text not null default '';
