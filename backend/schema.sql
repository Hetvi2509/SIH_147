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

-- One row per completed analysis run. `data` holds the full snapshot (parameters, classification
-- incl. graph/preview points, demodulation, FEC, bit stream, ...) as JSON -- the same shape the
-- frontend already builds for JSON export -- so history can restore a run without re-deriving it.
-- `summary` is a small subset of the same fields (SNR, bits recovered, BER, ...) kept alongside so
-- the history table can render without pulling the full (much larger, preview-array-laden) `data`
-- blob for every row.
CREATE TABLE IF NOT EXISTS analyses (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name     TEXT        NOT NULL,
  modulation    TEXT        NOT NULL,
  confidence    DOUBLE PRECISION NOT NULL,
  summary       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  data          JSONB       NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS summary JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id, created_at DESC);
