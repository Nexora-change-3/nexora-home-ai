CREATE TABLE IF NOT EXISTS nexora_design_sessions (
 session_id TEXT PRIMARY KEY NOT NULL,
 source_image_id TEXT NOT NULL,
 room_type TEXT NOT NULL,
 concepts_json TEXT NOT NULL,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nexora_design_sessions_expiry ON nexora_design_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_nexora_design_sessions_created ON nexora_design_sessions (created_at);
