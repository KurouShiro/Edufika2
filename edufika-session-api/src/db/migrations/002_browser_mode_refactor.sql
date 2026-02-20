DROP TABLE IF EXISTS exam_answers;
DROP TABLE IF EXISTS exam_questions;

CREATE TABLE IF NOT EXISTS session_browser_targets (
    exam_session_id UUID PRIMARY KEY REFERENCES exam_sessions(id) ON DELETE CASCADE,
    launch_url TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'web',
    lock_to_host BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_browser_targets_provider ON session_browser_targets(provider);
