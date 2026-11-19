CREATE TABLE IF NOT EXISTS nexora_render_dispatches (
  request_id TEXT PRIMARY KEY NOT NULL,
  source_image_ref TEXT NOT NULL,
  workflow_hash TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('submitting', 'outcome_unknown', 'queued', 'succeeded')),
  prompt_id TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((state = 'succeeded' AND result_json IS NOT NULL) OR state <> 'succeeded')
);

CREATE INDEX IF NOT EXISTS idx_nexora_render_dispatches_state_updated
  ON nexora_render_dispatches (state, updated_at);
