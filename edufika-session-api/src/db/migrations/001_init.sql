CREATE TABLE IF NOT EXISTS exam_sessions (
    id UUID PRIMARY KEY,
    exam_name TEXT,
    created_by TEXT,
    start_time TIMESTAMPTZ DEFAULT now(),
    end_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_tokens (
    token TEXT PRIMARY KEY,
    exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    claimed BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

ALTER TABLE IF EXISTS session_tokens
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS device_bindings (
    id UUID PRIMARY KEY,
    token TEXT NOT NULL REFERENCES session_tokens(token) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'student',
    device_fingerprint TEXT NOT NULL,
    ip_address TEXT,
    signature_version INT NOT NULL DEFAULT 1,
    risk_score INT NOT NULL DEFAULT 0,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    lock_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS heartbeats (
    id BIGSERIAL PRIMARY KEY,
    binding_id UUID NOT NULL REFERENCES device_bindings(id) ON DELETE CASCADE,
    focus BOOLEAN NOT NULL,
    multi_window BOOLEAN NOT NULL,
    risk_score INT NOT NULL,
    network_state TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS violations (
    id BIGSERIAL PRIMARY KEY,
    binding_id UUID NOT NULL REFERENCES device_bindings(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity INT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_whitelist (
    id BIGSERIAL PRIMARY KEY,
    exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(exam_session_id, url)
);

CREATE INDEX IF NOT EXISTS idx_session_tokens_exam_session_id ON session_tokens(exam_session_id);
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'session_tokens'
          AND column_name = 'expires_at'
    ) THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_session_tokens_expires_at ON session_tokens(expires_at)';
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_device_bindings_token ON device_bindings(token);
CREATE INDEX IF NOT EXISTS idx_device_bindings_last_seen ON device_bindings(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_heartbeats_binding_id_created_at ON heartbeats(binding_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_binding_id_created_at ON violations(binding_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_whitelist_exam_session_id ON session_whitelist(exam_session_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_status ON exam_sessions(status);
