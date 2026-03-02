package com.techivibes.edufika.data

import com.techivibes.edufika.utils.TestConstants
import java.util.UUID
import kotlin.math.max

enum class UserRole {
    NONE,
    STUDENT,
    ADMIN,
    DEVELOPER
}

object SessionState {
    var onStateChanged: (() -> Unit)? = null

    var currentToken: String = ""
        private set
    var currentRole: UserRole = UserRole.NONE
        private set
    var sessionId: String = ""
        private set
    var accessSignature: String = ""
        private set
    var deviceBindingId: String = ""
        private set
    var lastSignatureRotationMillis: Long = 0L
        private set
    var riskScore: Int = 0
        private set
    var lastHeartbeatMillis: Long = 0L
        private set
    var currentExamUrl: String = ""
        private set
    var examModeActive: Boolean = false
        private set
    var heartbeatSequence: Long = 0L
        private set

    private val lastRiskEventMillisByType = mutableMapOf<String, Long>()
    private val riskEventCooldownMs: Map<String, Long> = mapOf(
        TestConstants.EVENT_APP_BACKGROUND to 4_000L,
        TestConstants.EVENT_FOCUS_LOST to 4_000L,
        TestConstants.EVENT_OVERLAY_DETECTED to 20_000L,
        TestConstants.EVENT_ACCESSIBILITY_ACTIVE to 20_000L,
        TestConstants.EVENT_REPEATED_VIOLATION to 6_000L,
        TestConstants.EVENT_MEDIA_PROJECTION_ATTEMPT to 10_000L
    )

    private var sessionStartMillis: Long = 0L
    private var sessionExpiryMillis: Long = 0L

    fun startSession(
        token: String,
        role: UserRole,
        durationMillis: Long = TestConstants.SESSION_EXPIRY_MILLIS,
        sessionExpiresAtMillis: Long? = null,
        serverSessionId: String = UUID.randomUUID().toString(),
        signature: String = UUID.randomUUID().toString().replace("-", ""),
        bindingId: String = UUID.randomUUID().toString()
    ) {
        val now = System.currentTimeMillis()
        currentToken = token
        currentRole = role
        sessionId = serverSessionId
        accessSignature = signature
        deviceBindingId = bindingId
        riskScore = 0
        lastSignatureRotationMillis = now
        lastHeartbeatMillis = lastSignatureRotationMillis
        currentExamUrl = ""
        examModeActive = false
        heartbeatSequence = 0L
        lastRiskEventMillisByType.clear()
        sessionStartMillis = now
        sessionExpiryMillis = sessionExpiresAtMillis?.let { max(now, it) } ?: (sessionStartMillis + durationMillis)
        onStateChanged?.invoke()
    }

    fun isSessionExpired(): Boolean {
        if (currentRole == UserRole.NONE) return true
        return System.currentTimeMillis() > sessionExpiryMillis
    }

    fun isStudentSessionActive(): Boolean {
        return currentRole == UserRole.STUDENT && !isSessionExpired()
    }

    fun isStudentExamSessionActive(): Boolean {
        return isStudentSessionActive() && examModeActive && currentExamUrl.isNotBlank()
    }

    fun markHeartbeatNow() {
        lastHeartbeatMillis = System.currentTimeMillis()
        onStateChanged?.invoke()
    }

    fun nextHeartbeatSequence(): Long {
        heartbeatSequence += 1L
        onStateChanged?.invoke()
        return heartbeatSequence
    }

    fun setCurrentExamUrl(url: String) {
        currentExamUrl = url.trim()
        onStateChanged?.invoke()
    }

    fun setExamModeActive(active: Boolean) {
        examModeActive = active
        onStateChanged?.invoke()
    }

    fun restoreRuntimeState(
        risk: Int,
        lastSignatureRotation: Long,
        lastHeartbeat: Long,
        examUrl: String,
        heartbeatSeq: Long,
        examMode: Boolean
    ) {
        riskScore = risk.coerceAtLeast(0)
        lastSignatureRotationMillis = lastSignatureRotation.coerceAtLeast(0L)
        lastHeartbeatMillis = lastHeartbeat.coerceAtLeast(0L)
        currentExamUrl = examUrl
        examModeActive = examMode
        heartbeatSequence = heartbeatSeq.coerceAtLeast(0L)
        onStateChanged?.invoke()
    }

    fun heartbeatTimedOut(): Boolean {
        if (!isStudentSessionActive()) return false
        return System.currentTimeMillis() - lastHeartbeatMillis > TestConstants.HEARTBEAT_TIMEOUT_MILLIS
    }

    fun shouldRotateSignature(): Boolean {
        if (!isStudentSessionActive()) return false
        return System.currentTimeMillis() - lastSignatureRotationMillis >
            TestConstants.ACCESS_SIGNATURE_ROTATION_MILLIS
    }

    fun rotateAccessSignature(newSignature: String) {
        accessSignature = newSignature
        lastSignatureRotationMillis = System.currentTimeMillis()
    }

    fun registerRiskEvent(event: String): Int {
        if (shouldSuppressRiskEvent(event)) {
            return riskScore
        }
        val increment = when (event) {
            TestConstants.EVENT_APP_BACKGROUND -> TestConstants.RISK_APP_BACKGROUND
            TestConstants.EVENT_OVERLAY_DETECTED -> TestConstants.RISK_OVERLAY_DETECTED
            TestConstants.EVENT_ACCESSIBILITY_ACTIVE -> TestConstants.RISK_ACCESSIBILITY_ACTIVE
            TestConstants.EVENT_NETWORK_DROP -> 0
            TestConstants.EVENT_POWER_WARNING -> 0
            TestConstants.EVENT_RESTART_RECOVERY -> 0
            TestConstants.EVENT_OFFLINE_HEARTBEAT_SYNC -> 0
            TestConstants.EVENT_REPEATED_VIOLATION -> TestConstants.RISK_REPEATED_VIOLATION
            TestConstants.EVENT_MULTI_WINDOW -> TestConstants.RISK_MULTI_WINDOW
            TestConstants.EVENT_FOCUS_LOST -> TestConstants.RISK_FOCUS_LOST
            TestConstants.EVENT_MEDIA_PROJECTION_ATTEMPT -> TestConstants.RISK_MEDIA_PROJECTION_ATTEMPT
            else -> 1
        }
        riskScore += increment
        return riskScore
    }

    private fun shouldSuppressRiskEvent(event: String): Boolean {
        val cooldownMs = riskEventCooldownMs[event] ?: return false
        val now = System.currentTimeMillis()
        val previous = lastRiskEventMillisByType[event] ?: 0L
        if (previous > 0L && now - previous < cooldownMs) {
            return true
        }
        lastRiskEventMillisByType[event] = now
        return false
    }

    fun riskLocked(): Boolean = riskScore >= TestConstants.RISK_LOCK_THRESHOLD

    fun remainingSessionMillis(nowMillis: Long = System.currentTimeMillis()): Long {
        if (currentRole == UserRole.NONE || sessionExpiryMillis <= 0L) return 0L
        return max(0L, sessionExpiryMillis - nowMillis)
    }

    fun expiryTimestampMillis(): Long = sessionExpiryMillis

    fun clear() {
        currentToken = ""
        currentRole = UserRole.NONE
        sessionId = ""
        accessSignature = ""
        deviceBindingId = ""
        lastSignatureRotationMillis = 0L
        riskScore = 0
        lastHeartbeatMillis = 0L
        currentExamUrl = ""
        examModeActive = false
        heartbeatSequence = 0L
        lastRiskEventMillisByType.clear()
        sessionStartMillis = 0L
        sessionExpiryMillis = 0L
        onStateChanged?.invoke()
    }
}
