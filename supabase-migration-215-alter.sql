-- ICS 215 - Migrate to table-based layout
-- Run this if the ics_215_forms table already exists

-- Add resource_identifiers column
ALTER TABLE ics_215_forms
  ADD COLUMN IF NOT EXISTS resource_identifiers jsonb not null default '[]'::jsonb;

-- Drop old org_structure column (safe to ignore if doesn't exist)
DO $$ BEGIN ALTER TABLE ics_215_forms DROP COLUMN IF EXISTS org_structure; EXCEPTION WHEN undefined_column THEN NULL; END $$;
