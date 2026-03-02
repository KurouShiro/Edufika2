CREATE TABLE IF NOT EXISTS exam_sessions (
    id CHAR(36) PRIMARY KEY,
    exam_name TEXT,
    created_by TEXT,
    start_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    end_time DATETIME(3),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS session_tokens (
    token VARCHAR(128) PRIMARY KEY,
    exam_session_id CHAR(36) NOT NULL,
    claimed BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at DATETIME(3),
    expires_at DATETIME(3),
    role VARCHAR(32) NOT NULL DEFAULT 'student',
    CONSTRAINT fk_session_tokens_exam_session
      FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS device_bindings (
    id CHAR(36) PRIMARY KEY,
    token VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'student',
    device_fingerprint TEXT NOT NULL,
    ip_address TEXT,
    device_name VARCHAR(128),
    signature_version INT NOT NULL DEFAULT 1,
    risk_score INT NOT NULL DEFAULT 0,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    lock_reason TEXT,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_device_bindings_token
      FOREIGN KEY (token) REFERENCES session_tokens(token) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS heartbeats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    binding_id CHAR(36) NOT NULL,
    focus BOOLEAN NOT NULL,
    multi_window BOOLEAN NOT NULL,
    risk_score INT NOT NULL,
    network_state VARCHAR(64),
    payload JSON NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_heartbeats_binding
      FOREIGN KEY (binding_id) REFERENCES device_bindings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS violations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    binding_id CHAR(36) NOT NULL,
    type VARCHAR(128) NOT NULL,
    severity INT NOT NULL,
    metadata JSON NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_violations_binding
      FOREIGN KEY (binding_id) REFERENCES device_bindings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_whitelist (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_session_id CHAR(36) NOT NULL,
    url VARCHAR(512) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_session_whitelist_exam_session
      FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
    UNIQUE KEY uq_session_whitelist_exam_session_url (exam_session_id, url)
);

CREATE TABLE IF NOT EXISTS session_browser_targets (
    exam_session_id CHAR(36) PRIMARY KEY,
    launch_url TEXT NOT NULL,
    provider VARCHAR(64) NOT NULL DEFAULT 'web',
    lock_to_host BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_session_browser_targets_exam_session
      FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_proctor_pins (
    exam_session_id CHAR(36) NOT NULL,
    binding_id CHAR(36) NOT NULL,
    pin_hash TEXT NOT NULL,
    effective_date DATE NOT NULL,
    updated_by_binding_id CHAR(36),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (exam_session_id, binding_id),
    CONSTRAINT fk_session_proctor_pins_exam_session
      FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_session_proctor_pins_binding
      FOREIGN KEY (binding_id) REFERENCES device_bindings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_student_pin_templates (
    exam_session_id CHAR(36) NOT NULL,
    student_token VARCHAR(128) NOT NULL,
    pin_hash TEXT NOT NULL,
    effective_date DATE NOT NULL,
    updated_by_binding_id CHAR(36),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (exam_session_id, student_token),
    CONSTRAINT fk_session_student_pin_templates_exam_session
      FOREIGN KEY (exam_session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_session_student_pin_templates_student_token
      FOREIGN KEY (student_token) REFERENCES session_tokens(token) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_cleanup_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    exam_session_id CHAR(36) NOT NULL,
    session_status VARCHAR(32) NOT NULL,
    archived_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    archive_payload JSON NOT NULL
);

CREATE INDEX idx_session_tokens_exam_session_id
ON session_tokens (exam_session_id);

CREATE INDEX idx_session_tokens_expires_at
ON session_tokens (expires_at);

CREATE INDEX idx_session_tokens_exam_session_role
ON session_tokens (exam_session_id, role);

CREATE INDEX idx_device_bindings_token
ON device_bindings (token);

CREATE INDEX idx_device_bindings_last_seen
ON device_bindings (last_seen_at);

CREATE INDEX idx_heartbeats_binding_id_created_at
ON heartbeats (binding_id, created_at);

CREATE INDEX idx_violations_binding_id_created_at
ON violations (binding_id, created_at);

CREATE INDEX idx_session_whitelist_exam_session_id
ON session_whitelist (exam_session_id);

CREATE INDEX idx_exam_sessions_status
ON exam_sessions (status);

CREATE INDEX idx_session_browser_targets_provider
ON session_browser_targets (provider);

CREATE INDEX idx_session_proctor_pins_effective_date
ON session_proctor_pins (effective_date);

CREATE INDEX idx_session_proctor_pins_session_binding
ON session_proctor_pins (exam_session_id, binding_id);

CREATE INDEX idx_session_student_pin_templates_effective_date
ON session_student_pin_templates (effective_date);

CREATE INDEX idx_session_student_pin_templates_student_token
ON session_student_pin_templates (student_token);

CREATE INDEX idx_session_cleanup_audit_exam_session_id
ON session_cleanup_audit (exam_session_id);

CREATE INDEX idx_session_cleanup_audit_archived_at
ON session_cleanup_audit (archived_at);
