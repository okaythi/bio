-- schema.sql (Cloudflare D1 Database Schema)

-- 1. Core Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,               -- UUID v4
  email TEXT UNIQUE NOT NULL,        -- Lowercase user email
  password_hash TEXT NOT NULL,       -- Hex-encoded PBKDF2 password hash
  salt TEXT NOT NULL,                -- Per-user random 16-byte cryptographic salt
  role TEXT DEFAULT 'user',          -- 'admin', 'user'
  status TEXT DEFAULT 'active',      -- 'active', 'suspended', 'deleted'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  locale TEXT DEFAULT 'en-US',
  timezone TEXT DEFAULT 'UTC',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. User Subscriptions Table (Generic Tier Management)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id TEXT PRIMARY KEY,
  plan_tier TEXT DEFAULT 'free',      -- 'free', 'basic', 'premium', 'vip'
  status TEXT DEFAULT 'active',     -- 'active', 'past_due', 'canceled', 'trialing'
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. User Preferences & Player UI Behavior
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  theme TEXT DEFAULT 'dark',         -- 'dark', 'light', 'system'
  default_audio_lang TEXT DEFAULT 'en',
  default_subtitle_lang TEXT DEFAULT 'en',
  auto_play_next BOOLEAN DEFAULT 1,
  player_volume REAL DEFAULT 1.0,
  ui_settings_json TEXT DEFAULT '{}', -- Flexible JSON for UI layouts & custom states
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Notification Preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY,
  email_notifications BOOLEAN DEFAULT 1,
  new_releases_alert BOOLEAN DEFAULT 1,
  marketing_emails BOOLEAN DEFAULT 0,
  channels_json TEXT DEFAULT '{}',    -- JSON for WebPush keys, webhooks, etc.
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Watch History & Smart Recommendation Signals
CREATE TABLE IF NOT EXISTS user_watch_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  movie_id TEXT NOT NULL,
  progress_seconds REAL DEFAULT 0,
  duration_seconds REAL DEFAULT 0,
  completed BOOLEAN DEFAULT 0,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  watch_count INTEGER DEFAULT 1,
  last_watched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT DEFAULT '{}',   -- JSON for playback speed, device, skip counts
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Telemetry & Analytics Events
CREATE TABLE IF NOT EXISTS user_telemetry_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,                      -- Nullable for anonymous client telemetry
  session_id TEXT,
  event_type TEXT NOT NULL,          -- 'page_view', 'click', 'play_start', 'pause', 'error', etc.
  event_data_json TEXT DEFAULT '{}', -- Context payload (URL, query, latency, errors)
  device_info_json TEXT DEFAULT '{}',-- Browser, OS, resolution, memory specs
  ip_address TEXT,
  country TEXT,                      -- Captured via Cloudflare header (CF-IPCountry)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Dynamic Metadata Extension (Infinite Key-Value / JSON store per user)
CREATE TABLE IF NOT EXISTS user_metadata_ext (
  user_id TEXT NOT NULL,
  namespace TEXT NOT NULL,          -- e.g. 'recommendation_weights', 'ai_persona', 'experiments'
  data_json TEXT NOT NULL DEFAULT '{}',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, namespace),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 9. User Sessions Table (Stateful Auth & Device Revocation)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_devices (
  fingerprint_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_type TEXT,
  is_primary BOOLEAN DEFAULT 0,
  session_count INTEGER DEFAULT 1,
  total_time_active_seconds REAL DEFAULT 0,
  last_seen_at DATETIME,
  first_seen_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_locations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  country TEXT,
  region TEXT,
  city TEXT,
  ip_address TEXT,
  is_vpn BOOLEAN DEFAULT 0,
  weight REAL DEFAULT 1.0,
  last_seen_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_behavioral_profiles (
  user_id TEXT PRIMARY KEY,
  rage_click_frequency REAL DEFAULT 0,
  indecision_score REAL DEFAULT 0,
  content_commitment_score REAL DEFAULT 0,
  psychometric_state TEXT, 
  psychometric_vector_json TEXT, 
  last_calculated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_user_movie ON user_watch_history(user_id, movie_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_user ON user_telemetry_events(user_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_event ON user_telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_user ON user_locations(user_id);
