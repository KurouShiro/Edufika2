ALTER TABLE session_student_pin_templates
  ADD COLUMN IF NOT EXISTS student_token VARCHAR(128) NULL AFTER exam_session_id;

UPDATE session_student_pin_templates tpl
JOIN session_tokens st
  ON st.exam_session_id = tpl.exam_session_id
 AND st.role = 'student'
SET tpl.student_token = st.token
WHERE tpl.student_token IS NULL OR tpl.student_token = '';

DELETE tpl
FROM session_student_pin_templates tpl
LEFT JOIN session_tokens st
  ON st.exam_session_id = tpl.exam_session_id
 AND st.token = tpl.student_token
WHERE st.token IS NULL;

ALTER TABLE session_student_pin_templates
  MODIFY COLUMN student_token VARCHAR(128) NOT NULL;

ALTER TABLE session_student_pin_templates
  DROP PRIMARY KEY,
  ADD PRIMARY KEY (exam_session_id, student_token);
