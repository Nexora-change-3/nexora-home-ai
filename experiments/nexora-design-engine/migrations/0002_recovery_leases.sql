ALTER TABLE nexora_render_dispatches ADD COLUMN recovery_token TEXT;
ALTER TABLE nexora_render_dispatches ADD COLUMN recovery_lease_until TEXT;

CREATE INDEX IF NOT EXISTS idx_nexora_render_dispatches_recovery_lease
  ON nexora_render_dispatches (state, recovery_lease_until);
