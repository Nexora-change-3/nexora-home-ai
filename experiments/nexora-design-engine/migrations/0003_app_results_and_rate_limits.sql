CREATE TABLE IF NOT EXISTS nexora_render_images (
  request_id TEXT PRIMARY KEY NOT NULL,
  image_bytes BLOB NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nexora_render_images_expiry
  ON nexora_render_images (expires_at);

CREATE TABLE IF NOT EXISTS nexora_render_limits (
  ip_hash TEXT NOT NULL,
  utc_day TEXT NOT NULL,
  render_count INTEGER NOT NULL DEFAULT 0 CHECK (render_count >= 0),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (ip_hash, utc_day)
);
CREATE INDEX IF NOT EXISTS idx_nexora_render_limits_day
  ON nexora_render_limits (utc_day);
