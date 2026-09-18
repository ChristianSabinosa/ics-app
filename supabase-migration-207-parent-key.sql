-- Add parent_key column to ics_207_positions for OSC group hierarchy
-- This column links child positions (divisions/groups) to their parent branch

alter table ics_207_positions add column if not exists parent_key text not null default '';
