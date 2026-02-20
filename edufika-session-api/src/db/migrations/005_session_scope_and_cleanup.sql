ALTER TABLE session_tokens
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

UPDATE session_tokens st
SET role = 'admin'
WHERE EXISTS (
    SELECT 1
    FROM device_bindings db
    WHERE db.token = st.token
      AND db.role = 'admin'
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'session_tokens_role_check'
    ) THEN
        ALTER TABLE session_tokens
            ADD CONSTRAINT session_tokens_role_check CHECK (role IN ('student', 'admin'));
    END IF;
END $$;

WITH ranked AS (
    SELECT ctid,
           row_number() OVER (
               PARTITION BY exam_session_id, role
               ORDER BY claimed DESC, claimed_at DESC NULLS LAST, expires_at DESC NULLS LAST, token ASC
           ) AS rn
    FROM session_tokens
)
DELETE FROM session_tokens st
USING ranked r
WHERE st.ctid = r.ctid
  AND r.rn > 1
  AND st.role IN ('student', 'admin');

INSERT INTO session_tokens (token, exam_session_id, claimed, expires_at, role)
SELECT
    'S-' || UPPER(SUBSTRING(md5(random()::text || es.id::text || clock_timestamp()::text) FROM 1 FOR 10)),
    es.id,
    FALSE,
    now() + make_interval(mins => 120),
    'student'
FROM exam_sessions es
WHERE NOT EXISTS (
    SELECT 1
    FROM session_tokens st
    WHERE st.exam_session_id = es.id
      AND st.role = 'student'
);

INSERT INTO session_tokens (token, exam_session_id, claimed, expires_at, role)
SELECT
    'A-' || UPPER(SUBSTRING(md5(random()::text || es.id::text || clock_timestamp()::text) FROM 1 FOR 10)),
    es.id,
    FALSE,
    now() + make_interval(mins => 120),
    'admin'
FROM exam_sessions es
WHERE NOT EXISTS (
    SELECT 1
    FROM session_tokens st
    WHERE st.exam_session_id = es.id
      AND st.role = 'admin'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_session_tokens_exam_session_role
ON session_tokens (exam_session_id, role);

CREATE INDEX IF NOT EXISTS idx_session_tokens_exam_session_role
ON session_tokens (exam_session_id, role);

ALTER TABLE session_proctor_pins
ADD COLUMN IF NOT EXISTS binding_id UUID;

UPDATE session_proctor_pins spp
SET binding_id = COALESCE(
    spp.updated_by_binding_id,
    (
        SELECT db.id
        FROM device_bindings db
        JOIN session_tokens st ON st.token = db.token
        WHERE st.exam_session_id = spp.exam_session_id
          AND db.role = 'admin'
        ORDER BY db.created_at DESC
        LIMIT 1
    ),
    (
        SELECT db.id
        FROM device_bindings db
        JOIN session_tokens st ON st.token = db.token
        WHERE st.exam_session_id = spp.exam_session_id
        ORDER BY db.created_at DESC
        LIMIT 1
    )
)
WHERE binding_id IS NULL;

DELETE FROM session_proctor_pins
WHERE binding_id IS NULL;

ALTER TABLE session_proctor_pins
DROP CONSTRAINT IF EXISTS session_proctor_pins_pkey;

ALTER TABLE session_proctor_pins
ADD CONSTRAINT session_proctor_pins_pkey PRIMARY KEY (exam_session_id, binding_id);

ALTER TABLE session_proctor_pins
DROP CONSTRAINT IF EXISTS session_proctor_pins_binding_fk;

ALTER TABLE session_proctor_pins
ADD CONSTRAINT session_proctor_pins_binding_fk
FOREIGN KEY (binding_id) REFERENCES device_bindings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_session_proctor_pins_session_binding
ON session_proctor_pins (exam_session_id, binding_id);

CREATE TABLE IF NOT EXISTS session_cleanup_audit (
    id BIGSERIAL PRIMARY KEY,
    exam_session_id UUID NOT NULL,
    session_status TEXT NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archive_payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_session_cleanup_audit_exam_session_id
ON session_cleanup_audit (exam_session_id);

CREATE INDEX IF NOT EXISTS idx_session_cleanup_audit_archived_at
ON session_cleanup_audit (archived_at DESC);
