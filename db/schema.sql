PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artists TEXT NOT NULL,
  album TEXT,
  album_artist TEXT,
  track_number INTEGER,
  disc_number INTEGER,
  duration INTEGER NOT NULL DEFAULT 0,
  file_path TEXT NOT NULL,
  cover_path TEXT,
  source_url TEXT NOT NULL,
  youtube_video_id TEXT,
  downloaded_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (playlist_id, track_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT NOT NULL,
  played_at TEXT NOT NULL,
  duration_played INTEGER NOT NULL,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  capabilities TEXT NOT NULL DEFAULT '[]',
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS track_copies (
  track_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  availability TEXT NOT NULL,
  local_path TEXT,
  synced_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (track_id, device_id),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS download_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  requested_by_device_id TEXT,
  source_query TEXT,
  video_id TEXT,
  title TEXT,
  artists TEXT NOT NULL DEFAULT '[]',
  track_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requested_by_device_id) REFERENCES devices(id) ON DELETE SET NULL,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_plays_track_id ON plays(track_id);
CREATE INDEX IF NOT EXISTS idx_plays_played_at ON plays(played_at);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_position ON playlist_tracks(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_track_copies_device_id ON track_copies(device_id);
CREATE INDEX IF NOT EXISTS idx_download_jobs_status ON download_jobs(status);
