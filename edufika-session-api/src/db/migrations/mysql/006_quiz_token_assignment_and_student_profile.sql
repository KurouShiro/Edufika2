ALTER TABLE quiz_student_attempts
  ADD COLUMN IF NOT EXISTS student_name VARCHAR(128) NULL AFTER student_binding_id,
  ADD COLUMN IF NOT EXISTS student_class VARCHAR(64) NULL AFTER student_name,
  ADD COLUMN IF NOT EXISTS student_elective VARCHAR(128) NULL AFTER student_class;

CREATE TABLE IF NOT EXISTS quiz_token_assignments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_session_id CHAR(36) NOT NULL,
  student_token VARCHAR(64) NOT NULL,
  assigned_by_binding_id CHAR(36) NOT NULL,
  assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_quiz_token_assignments_exam_session
    FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_token_assignments_binding
    FOREIGN KEY (assigned_by_binding_id) REFERENCES device_bindings(id) ON DELETE CASCADE,
  UNIQUE KEY uq_quiz_token_assignments_session_token (exam_session_id, student_token)
);

CREATE INDEX idx_quiz_token_assignments_session
ON quiz_token_assignments (exam_session_id);

