ALTER TABLE session_tokens
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

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
        EXECUTE 'UPDATE session_tokens SET expires_at = now() + make_interval(mins => 120) WHERE expires_at IS NULL AND claimed = FALSE';
    END IF;
END $$;
