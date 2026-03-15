ALTER TABLE exam_sessions
  ADD COLUMN IF NOT EXISTS exam_mode VARCHAR(32) NOT NULL DEFAULT 'BROWSER_LOCKDOWN' AFTER status;

CREATE TABLE IF NOT EXISTS quiz_exams (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_session_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 60,
  show_results_immediately BOOLEAN NOT NULL DEFAULT TRUE,
  randomize_questions BOOLEAN NOT NULL DEFAULT FALSE,
  allow_review BOOLEAN NOT NULL DEFAULT TRUE,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_binding_id CHAR(36),
  updated_by_binding_id CHAR(36),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_quiz_exams_exam_session
    FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_quiz_exams_exam_session (exam_session_id)
);

CREATE TABLE IF NOT EXISTS quiz_subjects (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_session_id CHAR(36) NOT NULL,
  subject_code VARCHAR(64) NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  description TEXT,
  ordering INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_quiz_subjects_exam_session
    FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_quiz_subjects_session_code (exam_session_id, subject_code)
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_session_id CHAR(36) NOT NULL,
  subject_id BIGINT NOT NULL,
  question_text TEXT NOT NULL,
  question_type VARCHAR(32) NOT NULL DEFAULT 'single_choice',
  points INT NOT NULL DEFAULT 1,
  ordering INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_binding_id CHAR(36),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_quiz_questions_exam_session
    FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_questions_subject
    FOREIGN KEY (subject_id) REFERENCES quiz_subjects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_question_options (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT NOT NULL,
  option_key VARCHAR(16) NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  ordering INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_quiz_question_options_question
    FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_quiz_question_options_question_key (question_id, option_key)
);

CREATE TABLE IF NOT EXISTS quiz_student_attempts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_session_id CHAR(36) NOT NULL,
  student_binding_id CHAR(36) NOT NULL,
  started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  submitted_at DATETIME(3),
  status VARCHAR(32) NOT NULL DEFAULT 'STARTED',
  score DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_score DECIMAL(10,2) NOT NULL DEFAULT 0,
  duration_seconds INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_quiz_attempts_exam_session
    FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_attempts_student_binding
    FOREIGN KEY (student_binding_id) REFERENCES device_bindings(id) ON DELETE CASCADE,
  UNIQUE KEY uq_quiz_attempts_session_student (exam_session_id, student_binding_id)
);

CREATE TABLE IF NOT EXISTS quiz_student_answers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  attempt_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  selected_option_ids JSON,
  text_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  points_awarded DECIMAL(10,2) NOT NULL DEFAULT 0,
  answered_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_quiz_answers_attempt
    FOREIGN KEY (attempt_id) REFERENCES quiz_student_attempts(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_answers_question
    FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_quiz_answers_attempt_question (attempt_id, question_id)
);

CREATE TABLE IF NOT EXISTS quiz_teacher_submissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  exam_session_id CHAR(36) NOT NULL,
  binding_id CHAR(36) NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_quiz_teacher_submissions_exam_session
    FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_teacher_submissions_binding
    FOREIGN KEY (binding_id) REFERENCES device_bindings(id) ON DELETE CASCADE
);

CREATE INDEX idx_exam_sessions_exam_mode
ON exam_sessions (exam_mode);

CREATE INDEX idx_quiz_subjects_session
ON quiz_subjects (exam_session_id);

CREATE INDEX idx_quiz_questions_session_subject
ON quiz_questions (exam_session_id, subject_id);

CREATE INDEX idx_quiz_options_question
ON quiz_question_options (question_id);

CREATE INDEX idx_quiz_attempts_session
ON quiz_student_attempts (exam_session_id);

CREATE INDEX idx_quiz_attempts_student_binding
ON quiz_student_attempts (student_binding_id);

CREATE INDEX idx_quiz_answers_attempt
ON quiz_student_answers (attempt_id);

CREATE INDEX idx_quiz_answers_question
ON quiz_student_answers (question_id);

CREATE INDEX idx_quiz_teacher_submissions_session
ON quiz_teacher_submissions (exam_session_id);
