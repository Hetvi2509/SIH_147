CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_salt BYTEA       NOT NULL,
  password_hash BYTEA       NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the SHA-256 of the session token is stored, so a DB leak does not leak live sessions.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash BYTEA       PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
