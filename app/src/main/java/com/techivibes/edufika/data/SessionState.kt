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
        sessionStartMillis = now
        sessionExpiryMillis = sessionExpiresAtMillis?.let { max(now, it) } ?: (sessionStartMillis + durationMillis)
    }

    fun isSessionExpired(): Boolean {
        if (currentRole == UserRole.NONE) return true
        return System.currentTimeMillis() > sessionExpiryMillis
    }

    fun isStudentSessionActive(): Boolean {
        return currentRole == UserRole.STUDENT && !isSessionExpired()
    }

    fun markHeartbeatNow() {
        lastHeartbeatMillis = System.currentTimeMillis()
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
        val increment = when (event) {
            TestConstants.EVENT_APP_BACKGROUND -> TestConstants.RISK_APP_BACKGROUND
            TestConstants.EVENT_OVERLAY_DETECTED -> TestConstants.RISK_OVERLAY_DETECTED
            TestConstants.EVENT_ACCESSIBILITY_ACTIVE -> TestConstants.RISK_ACCESSIBILITY_ACTIVE
            TestConstants.EVENT_NETWORK_DROP -> TestConstants.RISK_NETWORK_DROP
            TestConstants.EVENT_REPEATED_VIOLATION -> TestConstants.RISK_REPEATED_VIOLATION
            TestConstants.EVENT_MULTI_WINDOW -> TestConstants.RISK_MULTI_WINDOW
            TestConstants.EVENT_FOCUS_LOST -> TestConstants.RISK_FOCUS_LOST
            TestConstants.EVENT_MEDIA_PROJECTION_ATTEMPT -> TestConstants.RISK_MEDIA_PROJECTION_ATTEMPT
            else -> 1
        }
        riskScore += increment
        return riskScore
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
        sessionStartMillis = 0L
        sessionExpiryMillis = 0L
    }
}
