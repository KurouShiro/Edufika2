DROP INDEX IF EXISTS idx_session_tokens_expires_at;

ALTER TABLE IF EXISTS session_tokens
DROP COLUMN IF EXISTS expires_at;
