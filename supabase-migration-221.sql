-- ICS 221: Demobilization Check-out
CREATE TABLE IF NOT EXISTS ics_221_forms (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id             text NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  incident_name           text NOT NULL DEFAULT '',
  resource_to_release     text NOT NULL DEFAULT '',
  planned_release_date    text NOT NULL DEFAULT '',
  planned_release_time    text NOT NULL DEFAULT '',

  -- Clearance sections (JSONB arrays of unit signoffs)
  logistics_units         jsonb NOT NULL DEFAULT '[]'::jsonb,
  finance_units           jsonb NOT NULL DEFAULT '[]'::jsonb,
  planning_units          jsonb NOT NULL DEFAULT '[]'::jsonb,
  operations_units        jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Remarks
  remarks                 text NOT NULL DEFAULT '',

  -- Reassignment
  for_reassignment        boolean NOT NULL DEFAULT false,
  reassignment_incident   text NOT NULL DEFAULT '',
  reassignment_location   text NOT NULL DEFAULT '',

  -- Travel
  room_overnight          boolean NOT NULL DEFAULT false,
  etd                     text NOT NULL DEFAULT '',
  destination             text NOT NULL DEFAULT '',
  travel_method           text NOT NULL DEFAULT '',
  manifest                boolean NOT NULL DEFAULT false,
  actual_release_date     text NOT NULL DEFAULT '',
  actual_release_time     text NOT NULL DEFAULT '',
  contact_details         text NOT NULL DEFAULT '',
  agency_notified         text NOT NULL DEFAULT '',

  -- Prepared by
  prepared_by_name        text NOT NULL DEFAULT '',
  prepared_by_sig         text NOT NULL DEFAULT '',
  prepared_date           text NOT NULL DEFAULT '',
  prepared_time           text NOT NULL DEFAULT '',

  status                  text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ics_221_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read 221 forms"
  ON ics_221_forms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert 221 forms"
  ON ics_221_forms FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update 221 forms"
  ON ics_221_forms FOR UPDATE
  TO authenticated
  USING (true);

CREATE INDEX idx_ics_221_incident_id ON ics_221_forms(incident_id);
