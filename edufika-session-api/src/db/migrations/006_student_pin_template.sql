CREATE TABLE IF NOT EXISTS session_student_pin_templates (
    exam_session_id UUID PRIMARY KEY REFERENCES exam_sessions(id) ON DELETE CASCADE,
    pin_hash TEXT NOT NULL,
    effective_date DATE NOT NULL,
    updated_by_binding_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_student_pin_templates_effective_date
ON session_student_pin_templates(effective_date);
