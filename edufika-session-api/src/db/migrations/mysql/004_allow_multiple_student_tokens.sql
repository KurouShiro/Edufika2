-- Allow multiple student tokens in the same exam session.
-- Previous schema used a unique index on (exam_session_id, role),
-- which limited each session to one student token and one admin token.

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'session_tokens'
    AND index_name = 'uq_session_tokens_exam_session_role'
);

SET @drop_stmt := IF(
  @idx_exists > 0,
  'ALTER TABLE session_tokens DROP INDEX uq_session_tokens_exam_session_role',
  'SELECT 1'
);

PREPARE stmt FROM @drop_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @non_unique_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'session_tokens'
    AND index_name = 'idx_session_tokens_exam_session_role'
);

SET @create_stmt := IF(
  @non_unique_exists = 0,
  'CREATE INDEX idx_session_tokens_exam_session_role ON session_tokens (exam_session_id, role)',
  'SELECT 1'
);

PREPARE stmt2 FROM @create_stmt;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
