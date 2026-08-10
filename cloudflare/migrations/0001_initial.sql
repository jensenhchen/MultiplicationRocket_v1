CREATE TABLE IF NOT EXISTS device_snapshots (
  device_id TEXT PRIMARY KEY,
  progress_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_snapshots_updated_at
  ON device_snapshots(updated_at);
