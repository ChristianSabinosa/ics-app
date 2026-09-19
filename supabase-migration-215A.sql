-- ICS 215-A: Incident/Event Safety, Risk and Health Analysis
CREATE TABLE IF NOT EXISTS ics_215a_forms (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id             text NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  incident_name           text NOT NULL DEFAULT '',
  op_period_from_date     text NOT NULL DEFAULT '',
  op_period_from_time     text NOT NULL DEFAULT '',
  op_period_to_date       text NOT NULL DEFAULT '',
  op_period_to_time       text NOT NULL DEFAULT '',
  hazard_identifiers      jsonb NOT NULL DEFAULT '[]'::jsonb,
  divisions               jsonb NOT NULL DEFAULT '[]'::jsonb,
  status                  text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted')),
  prepared_by_sofr        text NOT NULL DEFAULT '',
  date_prepared_sofr      text NOT NULL DEFAULT '',
  time_prepared_sofr      text NOT NULL DEFAULT '',
  prepared_by_osc         text NOT NULL DEFAULT '',
  date_prepared_osc       text NOT NULL DEFAULT '',
  time_prepared_osc       text NOT NULL DEFAULT '',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ics_215a_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read 215A forms"
  ON ics_215a_forms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert 215A forms"
  ON ics_215a_forms FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update 215A forms"
  ON ics_215a_forms FOR UPDATE
  TO authenticated
  USING (true);

CREATE INDEX idx_ics_215a_incident_id ON ics_215a_forms(incident_id);
