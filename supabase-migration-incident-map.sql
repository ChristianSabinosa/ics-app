-- Incident Map (uploaded JPG/PNG with crop, one map per incident)
CREATE TABLE IF NOT EXISTS incident_maps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id   text NOT NULL UNIQUE REFERENCES incidents(incident_id) ON DELETE CASCADE,
  map_image     text NOT NULL DEFAULT '',   -- data URL of the cropped map (image/jpeg or image/png)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE incident_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read incident maps"
  ON incident_maps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert incident maps"
  ON incident_maps FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update incident maps"
  ON incident_maps FOR UPDATE
  TO authenticated
  USING (true);

CREATE INDEX idx_incident_maps_incident_id ON incident_maps(incident_id);
