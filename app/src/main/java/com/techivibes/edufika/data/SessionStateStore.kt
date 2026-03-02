package com.techivibes.edufika.data

import android.content.Context
import com.techivibes.edufika.utils.TestConstants
import org.json.JSONObject

object SessionStateStore {
    @Volatile
    private var appContext: Context? = null

    fun bind(context: Context) {
        appContext = context.applicationContext
        SessionState.onStateChanged = { persist() }
    }

    fun persist() {
        val context = appContext ?: return
        val payload = JSONObject()
            .put("token", SessionState.currentToken)
            .put("role", SessionState.currentRole.name)
            .put("session_id", SessionState.sessionId)
            .put("access_signature", SessionState.accessSignature)
            .put("device_binding_id", SessionState.deviceBindingId)
            .put("risk_score", SessionState.riskScore)
            .put("last_signature_rotation_ms", SessionState.lastSignatureRotationMillis)
            .put("last_heartbeat_ms", SessionState.lastHeartbeatMillis)
            .put("expiry_ms", SessionState.expiryTimestampMillis())
            .put("current_exam_url", SessionState.currentExamUrl)
            .put("exam_mode_active", SessionState.examModeActive)
            .put("heartbeat_seq", SessionState.heartbeatSequence)

        prefs(context).edit()
            .putString(TestConstants.PREF_SESSION_SNAPSHOT, payload.toString())
            .apply()
    }

    fun restore(): Boolean {
        val context = appContext ?: return false
        val raw = prefs(context).getString(TestConstants.PREF_SESSION_SNAPSHOT, null) ?: return false
        val node = runCatching { JSONObject(raw) }.getOrNull() ?: return false

        val role = parseRole(node.optString("role"))
        val token = node.optString("token").trim()
        val sessionId = node.optString("session_id").trim()
        val signature = node.optString("access_signature").trim()
        val bindingId = node.optString("device_binding_id").trim()
        if (role == UserRole.NONE || token.isBlank() || sessionId.isBlank() || signature.isBlank() || bindingId.isBlank()) {
            return false
        }

        val expiry = node.optLong("expiry_ms", 0L)
        if (expiry > 0L && System.currentTimeMillis() > expiry) {
            clear()
            return false
        }
        SessionState.startSession(
            token = token,
            role = role,
            sessionExpiresAtMillis = if (expiry > 0L) expiry else null,
            serverSessionId = sessionId,
            signature = signature,
            bindingId = bindingId
        )
        SessionState.restoreRuntimeState(
            risk = node.optInt("risk_score", 0),
            lastSignatureRotation = node.optLong("last_signature_rotation_ms", 0L),
            lastHeartbeat = node.optLong("last_heartbeat_ms", 0L),
            examUrl = node.optString("current_exam_url").trim(),
            heartbeatSeq = node.optLong("heartbeat_seq", 0L),
            examMode = node.optBoolean("exam_mode_active", false)
        )
        return true
    }

    fun clear() {
        val context = appContext ?: return
        prefs(context).edit()
            .remove(TestConstants.PREF_SESSION_SNAPSHOT)
            .apply()
    }

    fun markRecoveryPending(reason: String) {
        val context = appContext ?: return
        prefs(context).edit()
            .putString(TestConstants.PREF_PENDING_RECOVERY_REASON, reason)
            .apply()
    }

    fun consumePendingRecoveryReason(): String? {
        val context = appContext ?: return null
        val prefs = prefs(context)
        val reason = prefs.getString(TestConstants.PREF_PENDING_RECOVERY_REASON, null)?.trim()
        prefs.edit().remove(TestConstants.PREF_PENDING_RECOVERY_REASON).apply()
        return reason?.takeIf { it.isNotBlank() }
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)

    private fun parseRole(raw: String): UserRole {
        return when (raw.uppercase()) {
            UserRole.STUDENT.name -> UserRole.STUDENT
            UserRole.ADMIN.name -> UserRole.ADMIN
            UserRole.DEVELOPER.name -> UserRole.DEVELOPER
            else -> UserRole.NONE
        }
    }
}
