DROP INDEX IF EXISTS idx_session_cleanup_audit_archived_at;
DROP INDEX IF EXISTS idx_session_cleanup_audit_exam_session_id;
DROP TABLE IF EXISTS session_cleanup_audit;

ALTER TABLE session_proctor_pins
DROP CONSTRAINT IF EXISTS session_proctor_pins_binding_fk;

DROP INDEX IF EXISTS idx_session_proctor_pins_session_binding;

ALTER TABLE session_proctor_pins
DROP CONSTRAINT IF EXISTS session_proctor_pins_pkey;

ALTER TABLE session_proctor_pins
ADD CONSTRAINT session_proctor_pins_pkey PRIMARY KEY (exam_session_id);

ALTER TABLE session_proctor_pins
DROP COLUMN IF EXISTS binding_id;

DROP INDEX IF EXISTS idx_session_tokens_exam_session_role;
DROP INDEX IF EXISTS uq_session_tokens_exam_session_role;

ALTER TABLE session_tokens
DROP CONSTRAINT IF EXISTS session_tokens_role_check;

ALTER TABLE session_tokens
DROP COLUMN IF EXISTS role;
