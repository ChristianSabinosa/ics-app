-- ICS 201: Incident Briefing
CREATE TABLE IF NOT EXISTS ics_201_forms (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id       text NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  incident_name     text NOT NULL DEFAULT '',

  -- ICS 201-1
  date_prepared     text NOT NULL DEFAULT '',
  time_prepared     text NOT NULL DEFAULT '',
  situation_summary text NOT NULL DEFAULT '',          -- 5. Situation Summary and Health and Safety Briefing
                                                   -- (field 4 map sketch uses the incident map from incident_maps)

  -- ICS 201-2
  objectives        jsonb NOT NULL DEFAULT '[]'::jsonb, -- bullet rows: ["objective", ...]
  actions           jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ date_time, action }, ...]

  -- ICS 201-4
  resources         jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ resource, identifier, requested, eta, arrived, remarks }, ...]
                    -- (ICS 201-3 organization chart is retrieved from ics_207_forms / ics_207_positions)

  -- Prepared by IC (footer rows 6 / 9 / 11 / 13)
  prepared_by_name  text NOT NULL DEFAULT '',
  prepared_by_sig   text NOT NULL DEFAULT '',
  prepared_date     text NOT NULL DEFAULT '',
  prepared_time     text NOT NULL DEFAULT '',

  status            text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ics_201_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read 201 forms"
  ON ics_201_forms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert 201 forms"
  ON ics_201_forms FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update 201 forms"
  ON ics_201_forms FOR UPDATE
  TO authenticated
  USING (true);

CREATE INDEX idx_ics_201_incident_id ON ics_201_forms(incident_id);
