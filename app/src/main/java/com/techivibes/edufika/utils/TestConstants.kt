package com.techivibes.edufika.utils

object TestConstants {
    const val STUDENT_TOKEN = "StudentID"
    const val ADMIN_TOKEN = "AdminID"
    const val DEVELOPER_ACCESS_PASSWORD = "EDU_DEV_ACCESS"
    const val DEFAULT_PROCTOR_PIN = "4321"
    const val SESSION_EXPIRY_MILLIS = 2 * 60 * 60 * 1000L
    const val HEARTBEAT_INTERVAL_MILLIS = 7_000L
    const val HEARTBEAT_TIMEOUT_MILLIS = 30_000L
    const val HEARTBEAT_SUSPEND_MILLIS = 90_000L
    const val HEARTBEAT_LOCK_MILLIS = 180_000L
    const val ACCESS_SIGNATURE_ROTATION_MILLIS = 5 * 60 * 1000L
    const val RISK_LOCK_THRESHOLD = 12

    const val PREFS_NAME = "edufika_prefs"
    const val PREF_URL_WHITELIST = "pref_url_whitelist"
    const val PREF_SESSION_LOGS = "pref_session_logs"
    const val PREF_APP_LOCK_ENABLED = "pref_app_lock_enabled"
    const val PREF_PROCTOR_PIN = "pref_proctor_pin"
    const val PREF_LAST_EXIT_CLEAN = "pref_last_exit_clean"
    const val PREF_SERVER_BASE_URL = "pref_server_base_url"
    const val PREF_DEVICE_BINDING_ID = "pref_device_binding_id"
    const val PREF_ISSUED_TOKENS = "pref_issued_tokens"
    const val PREF_LAST_STUDENT_TOKEN = "pref_last_student_token"
    const val PREF_SESSION_SNAPSHOT = "pref_session_snapshot"
    const val PREF_PENDING_RECOVERY_REASON = "pref_pending_recovery_reason"
    const val PREF_OFFLINE_EVENT_QUEUE = "pref_offline_event_queue"
    const val PREF_OFFLINE_HEARTBEAT_QUEUE = "pref_offline_heartbeat_queue"
    const val LOGGER_FILE_NAME = "logger.txt"

    const val ARG_EXAM_URL = "examUrl"
    const val ARG_DEVELOPER_BYPASS = "developerBypass"
    const val ARG_VIOLATION_MESSAGE = "violationMessage"

    const val SERVER_BASE_URL = "https://edufika.local"
    const val TLS_PIN_HOST = "edufika.local"
    const val TLS_PIN_SHA256 = "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    const val DEFAULT_TOKEN_EXPIRY_MINUTES = 120
    const val MIN_TOKEN_EXPIRY_MINUTES = 1
    const val MAX_TOKEN_EXPIRY_MINUTES = 43200

    const val ACTION_SESSION_LOCKED = "com.techivibes.edufika.ACTION_SESSION_LOCKED"
    const val ACTION_HEARTBEAT_STATUS = "com.techivibes.edufika.ACTION_HEARTBEAT_STATUS"
    const val EXTRA_LOCK_REASON = "extra_lock_reason"
    const val EXTRA_HEARTBEAT_MESSAGE = "extra_heartbeat_message"
    const val EXTRA_HEARTBEAT_STATE = "extra_heartbeat_state"

    const val EVENT_APP_BACKGROUND = "APP_BACKGROUND"
    const val EVENT_OVERLAY_DETECTED = "OVERLAY_DETECTED"
    const val EVENT_ACCESSIBILITY_ACTIVE = "ACCESSIBILITY_ACTIVE"
    const val EVENT_NETWORK_DROP = "NETWORK_DROP"
    const val EVENT_POWER_WARNING = "POWER_WARNING"
    const val EVENT_RESTART_RECOVERY = "RESTART_RECOVERY"
    const val EVENT_OFFLINE_HEARTBEAT_SYNC = "OFFLINE_HEARTBEAT_SYNC"
    const val EVENT_REPEATED_VIOLATION = "REPEATED_VIOLATION"
    const val EVENT_MULTI_WINDOW = "MULTI_WINDOW"
    const val EVENT_FOCUS_LOST = "FOCUS_LOST"
    const val EVENT_MEDIA_PROJECTION_ATTEMPT = "MEDIA_PROJECTION_ATTEMPT"

    const val RISK_APP_BACKGROUND = 3
    const val RISK_OVERLAY_DETECTED = 5
    const val RISK_ACCESSIBILITY_ACTIVE = 5
    const val RISK_NETWORK_DROP = 2
    const val RISK_REPEATED_VIOLATION = 6
    const val RISK_MULTI_WINDOW = 4
    const val RISK_FOCUS_LOST = 3
    const val RISK_MEDIA_PROJECTION_ATTEMPT = 2
}
