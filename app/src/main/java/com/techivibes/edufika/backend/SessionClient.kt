package com.techivibes.edufika.backend

import android.content.Context
import com.techivibes.edufika.BuildConfig
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.data.UserRole
import com.techivibes.edufika.utils.TestUtils
import com.techivibes.edufika.utils.TestConstants
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.CertificatePinner
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.net.URLEncoder
import java.util.UUID
import java.util.concurrent.TimeUnit

data class ClaimResponse(
    val sessionId: String,
    val accessSignature: String,
    val role: String,
    val deviceBindingId: String,
    val tokenExpiresAtMillis: Long?,
    val launchUrl: String?,
    val whitelist: List<String>
)

data class CreateSessionResponse(
    val sessionId: String,
    val token: String?,
    val tokens: List<String>,
    val launchUrl: String?
)

data class LaunchConfigResponse(
    val launchUrl: String?,
    val provider: String?,
    val lockToHost: Boolean
)

data class HeartbeatPayload(
    val focus: Boolean,
    val multiWindow: Boolean,
    val networkState: String,
    val deviceState: String,
    val timestamp: Long,
    val heartbeatSeq: Long,
    val riskScore: Int,
    val overlayDetected: Boolean,
    val accessibilityActive: Boolean,
    val debugDetected: Boolean,
    val emulatorDetected: Boolean,
    val rooted: Boolean
)

data class HeartbeatResponse(
    val accepted: Boolean,
    val lock: Boolean,
    val rotateSignature: String?,
    val message: String,
    val whitelist: List<String>,
    val sessionState: String
)

data class ReconnectResponse(
    val accepted: Boolean,
    val accessSignature: String?,
    val expiresIn: Int,
    val message: String,
    val whitelist: List<String>,
    val sessionState: String
)

data class SignatureReissueResponse(
    val ok: Boolean,
    val bindingId: String?,
    val accessSignature: String?,
    val expiresIn: Int,
    val sessionState: String?
)

data class ProctorPinStatusResponse(
    val configured: Boolean,
    val effectiveDate: String?,
    val isActiveToday: Boolean,
    val studentToken: String?
)

data class ProctorPinVerifyResponse(
    val valid: Boolean,
    val reason: String?,
    val effectiveDate: String?
)

class SessionClient(private val context: Context) {

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    @Volatile
    private var lastApiError: String? = null

    private val strictClient: OkHttpClient by lazy {
        OkHttpClient.Builder().apply {
            if (hasConfiguredTlsPin()) {
                certificatePinner(
                    CertificatePinner.Builder()
                        .add(TestConstants.TLS_PIN_HOST, TestConstants.TLS_PIN_SHA256)
                        .build()
                )
            }
        }
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(8, TimeUnit.SECONDS)
            .build()
    }

    private val fallbackClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(8, TimeUnit.SECONDS)
            .build()
    }

    fun getServerBaseUrl(): String {
        val prefs = context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
        val stored = prefs.getString(TestConstants.PREF_SERVER_BASE_URL, TestConstants.SERVER_BASE_URL)
            ?: TestConstants.SERVER_BASE_URL
        return normalizeBaseUrl(stored)
    }

    fun setServerBaseUrl(rawBaseUrl: String) {
        val normalized = normalizeBaseUrl(rawBaseUrl)
        context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(TestConstants.PREF_SERVER_BASE_URL, normalized)
            .apply()
    }

    private suspend fun postJson(
        path: String,
        body: JSONObject,
        bearerToken: String? = null,
        extraHeaders: Map<String, String> = emptyMap()
    ): JSONObject? = withContext(Dispatchers.IO) {
        val base = getServerBaseUrl().trimEnd('/')
        val requestBuilder = Request.Builder()
            .url("$base$path")
            .post(body.toString().toRequestBody(jsonMediaType))
        if (!bearerToken.isNullOrBlank()) {
            requestBuilder.header("Authorization", "Bearer $bearerToken")
        }
        extraHeaders.forEach { (name, value) ->
            if (name.isNotBlank() && value.isNotBlank()) {
                requestBuilder.header(name, value)
            }
        }
        val request = requestBuilder.build()
        executeWithFallback(request)
    }

    private suspend fun getJson(path: String, bearerToken: String? = null): JSONObject? = withContext(Dispatchers.IO) {
        val base = getServerBaseUrl().trimEnd('/')
        val requestBuilder = Request.Builder()
            .url("$base$path")
            .get()
        if (!bearerToken.isNullOrBlank()) {
            requestBuilder.header("Authorization", "Bearer $bearerToken")
        }
        val request = requestBuilder.build()
        executeWithFallback(request)
    }

    fun consumeLastApiError(): String? {
        val current = lastApiError
        lastApiError = null
        return current
    }

    private fun executeWithFallback(request: Request): JSONObject? {
        lastApiError = null
        val strictResult = runCatching { strictClient.newCall(request).execute() }
        if (strictResult.isSuccess) {
            strictResult.getOrNull()?.use { response ->
                if (!response.isSuccessful) {
                    val body = response.body?.string().orEmpty()
                    val message = runCatching { JSONObject(body).optString("error") }.getOrNull()
                    lastApiError = "HTTP ${response.code}${if (message.isNullOrBlank()) "" else " - $message"}"
                    return null
                }
                return response.body?.string()?.takeIf { it.isNotBlank() }?.let { JSONObject(it) }
            }
        } else {
            lastApiError = strictResult.exceptionOrNull()?.message
            if (!BuildConfig.DEV_TOOLS_ENABLED) {
                return null
            }
        }

        val fallbackResult = runCatching { fallbackClient.newCall(request).execute() }
        if (fallbackResult.isSuccess) {
            fallbackResult.getOrNull()?.use { response ->
                if (!response.isSuccessful) {
                    val body = response.body?.string().orEmpty()
                    val message = runCatching { JSONObject(body).optString("error") }.getOrNull()
                    lastApiError = "HTTP ${response.code}${if (message.isNullOrBlank()) "" else " - $message"}"
                    return null
                }
                return response.body?.string()?.takeIf { it.isNotBlank() }?.let { JSONObject(it) }
            }
        } else {
            lastApiError = fallbackResult.exceptionOrNull()?.message ?: lastApiError
        }

        return null
    }

    suspend fun createSessionBundle(
        proctorId: String,
        launchUrl: String? = null,
        tokenTtlMinutes: Int? = null,
        tokenCount: Int? = null
    ): CreateSessionResponse? {
        val body = JSONObject()
            .put("proctor_id", proctorId)
            .put("timestamp", System.currentTimeMillis())
        if (!launchUrl.isNullOrBlank()) {
            body.put("launch_url", TestUtils.normalizeUrl(launchUrl))
        }
        if (tokenTtlMinutes != null) {
            body.put("token_ttl_minutes", tokenTtlMinutes)
        }
        if (tokenCount != null) {
            body.put("token_count", tokenCount)
        }
        val extraHeaders = mutableMapOf<String, String>()
        if (TestConstants.ADMIN_CREATE_KEY.isNotBlank()) {
            extraHeaders["x-admin-create-key"] = TestConstants.ADMIN_CREATE_KEY
        }
        val response = postJson("/session/create", body, extraHeaders = extraHeaders) ?: return null
        return CreateSessionResponse(
            sessionId = response.optString("session_id"),
            token = response.optString("token").ifBlank { null },
            tokens = response.optJSONArray("tokens").toStringList(),
            launchUrl = response.optString("launch_url").ifBlank { null }
        )
    }

    suspend fun createSession(
        proctorId: String,
        launchUrl: String? = null,
        tokenTtlMinutes: Int? = null
    ): String? {
        return createSessionBundle(
            proctorId = proctorId,
            launchUrl = launchUrl,
            tokenTtlMinutes = tokenTtlMinutes
        )?.token
    }

    suspend fun claimSession(token: String, roleHint: String): ClaimResponse? {
        val binding = deviceBindingId()
        val body = JSONObject()
            .put("token", token)
            .put("device_binding_id", binding)
            .put("role_hint", roleHint)
            .put("timestamp", System.currentTimeMillis())

        val response = postJson("/session/claim", body) ?: return null
        val sessionId = response.optString("session_id")
        val signature = response.optString("access_signature")
        if (sessionId.isBlank() || signature.isBlank()) return null

        val role = response.optString("role", "student")
        val serverBindingId = response.optString("device_binding_id").ifBlank { binding }
        val tokenExpiresAtMillis = response.optString("token_expires_at")
            .ifBlank { null }
            ?.let { parseIsoMillis(it) }
        val launchUrl = response.optString("launch_url").ifBlank { null }
        val whitelist = response.optJSONArray("whitelist").toStringList()
        return ClaimResponse(
            sessionId = sessionId,
            accessSignature = signature,
            role = role,
            deviceBindingId = serverBindingId,
            tokenExpiresAtMillis = tokenExpiresAtMillis,
            launchUrl = launchUrl,
            whitelist = whitelist
        )
    }

    suspend fun sendHeartbeat(payload: HeartbeatPayload): HeartbeatResponse? {
        val body = JSONObject()
            .put("session_id", SessionState.sessionId)
            .put("access_signature", SessionState.accessSignature)
            .put("device_binding_id", SessionState.deviceBindingId)
            .put("focus", payload.focus)
            .put("multi_window", payload.multiWindow)
            .put("network_state", payload.networkState)
            .put("device_state", payload.deviceState)
            .put("timestamp", payload.timestamp)
            .put("heartbeat_seq", payload.heartbeatSeq)
            .put("risk_score", payload.riskScore)
            .put("overlay_detected", payload.overlayDetected)
            .put("accessibility_active", payload.accessibilityActive)
            .put("debug_detected", payload.debugDetected)
            .put("emulator_detected", payload.emulatorDetected)
            .put("rooted", payload.rooted)

        val response = postJson("/session/heartbeat", body) ?: return null
        return HeartbeatResponse(
            accepted = response.optBoolean("accepted", true),
            lock = response.optBoolean("lock", false),
            rotateSignature = response.optString("rotate_signature").ifBlank { null },
            message = response.optString("message", "heartbeat ok"),
            whitelist = response.optJSONArray("whitelist").toStringList(),
            sessionState = response.optString("session_state", "ACTIVE")
        )
    }

    suspend fun reconnectSession(reason: String = "CLIENT_RECOVERY"): ReconnectResponse? {
        if (SessionState.sessionId.isBlank() || SessionState.deviceBindingId.isBlank()) return null
        val body = JSONObject()
            .put("session_id", SessionState.sessionId)
            .put("device_binding_id", SessionState.deviceBindingId)
            .put("device_fingerprint", SessionState.deviceBindingId)
            .put("reason", reason)
        if (SessionState.currentRole == UserRole.STUDENT && SessionState.currentToken.isNotBlank()) {
            body.put("token", SessionState.currentToken)
        }
        if (SessionState.accessSignature.isNotBlank()) {
            body.put("access_signature", SessionState.accessSignature)
        }
        val response = postJson("/session/reconnect", body) ?: return null
        return ReconnectResponse(
            accepted = response.optBoolean("accepted", false),
            accessSignature = response.optString("access_signature").ifBlank { null },
            expiresIn = response.optInt("expires_in", 0),
            message = response.optString("message", "reconnect"),
            whitelist = response.optJSONArray("whitelist").toStringList(),
            sessionState = response.optString("session_state", "IN_PROGRESS")
        )
    }

    suspend fun sendViolationEvent(
        type: String,
        detail: String,
        riskScore: Int,
        metadata: JSONObject? = null
    ): Boolean {
        val body = JSONObject()
            .put("session_id", SessionState.sessionId)
            .put("access_signature", SessionState.accessSignature)
            .put("event_type", type)
            .put("detail", detail)
            .put("risk_score", riskScore)
            .put("timestamp", System.currentTimeMillis())
        if (metadata != null) {
            body.put("metadata", metadata)
        }
        return postJson("/session/event", body) != null
    }

    suspend fun fetchWhitelist(): List<String>? {
        val path = "/session/whitelist?session_id=${SessionState.sessionId}"
        val response = getJson(path) ?: return null
        return response.optJSONArray("whitelist").toStringList()
    }

    suspend fun fetchLaunchConfig(
        sessionId: String = SessionState.sessionId,
        accessSignature: String = SessionState.accessSignature
    ): LaunchConfigResponse? {
        if (sessionId.isBlank() || accessSignature.isBlank()) return null
        val encodedSession = urlEncode(sessionId)
        val path = "/exam/launch?session_id=$encodedSession"
        val response = getJson(path, bearerToken = accessSignature) ?: return null
        return LaunchConfigResponse(
            launchUrl = response.optString("launch_url").ifBlank { null },
            provider = response.optString("provider").ifBlank { null },
            lockToHost = response.optBoolean("lock_to_host", true)
        )
    }

    suspend fun pingHealth(): Boolean {
        val response = getJson("/health") ?: return false
        return response.optBoolean("ok", false)
    }

    suspend fun addWhitelistUrl(url: String): Boolean {
        val body = JSONObject()
            .put("session_id", SessionState.sessionId)
            .put("access_signature", SessionState.accessSignature)
            .put("url", url)
        return postJson("/session/whitelist/add", body) != null
    }

    suspend fun verifyWhitelistUrl(url: String): Boolean? {
        val body = JSONObject()
            .put("session_id", SessionState.sessionId)
            .put("access_signature", SessionState.accessSignature)
            .put("url", url)
        val response = postJson("/session/whitelist/verify", body) ?: return null
        return response.optBoolean("allowed", false)
    }

    suspend fun finishSession(): Boolean {
        return finishSession(
            sessionId = SessionState.sessionId,
            accessSignature = SessionState.accessSignature
        )
    }

    suspend fun finishSession(sessionId: String, accessSignature: String): Boolean {
        if (sessionId.isBlank() || accessSignature.isBlank()) return false
        val body = JSONObject()
            .put("session_id", sessionId)
            .put("access_signature", accessSignature)
            .put("timestamp", System.currentTimeMillis())
        return postJson("/session/finish", body) != null
    }

    suspend fun revokeSession(reason: String): Boolean {
        val body = JSONObject()
            .put("session_id", SessionState.sessionId)
            .put("access_signature", SessionState.accessSignature)
            .put("reason", reason)
            .put("timestamp", System.currentTimeMillis())
        return postJson("/admin/revoke", body) != null
    }

    suspend fun pauseSession(): Boolean {
        val body = JSONObject()
            .put("session_id", SessionState.sessionId)
            .put("access_signature", SessionState.accessSignature)
        return postJson("/admin/pause", body) != null
    }

    suspend fun resumeSession(): Boolean {
        val body = JSONObject()
            .put("session_id", SessionState.sessionId)
            .put("access_signature", SessionState.accessSignature)
        return postJson("/admin/resume", body) != null
    }

    suspend fun reissueStudentSignature(studentBindingId: String? = null): SignatureReissueResponse? {
        val body = JSONObject()
            .put("session_id", SessionState.sessionId)
            .put("access_signature", SessionState.accessSignature)
        if (!studentBindingId.isNullOrBlank()) {
            body.put("student_binding_id", studentBindingId.trim())
        }
        val response = postJson("/admin/reissue-signature", body) ?: return null
        return SignatureReissueResponse(
            ok = response.optBoolean("ok", false),
            bindingId = response.optString("binding_id").ifBlank { null },
            accessSignature = response.optString("access_signature").ifBlank { null },
            expiresIn = response.optInt("expires_in", 0),
            sessionState = response.optString("session_state").ifBlank { null }
        )
    }

    suspend fun setProctorPin(pin: String, studentToken: String? = null): ProctorPinStatusResponse? {
        val body = JSONObject()
            .put("session_id", SessionState.sessionId)
            .put("access_signature", SessionState.accessSignature)
            .put("pin", pin.trim())
        if (!studentToken.isNullOrBlank()) {
            body.put("student_token", studentToken.trim())
        }
        val response = postJson("/session/proctor-pin/set", body) ?: return null
        return ProctorPinStatusResponse(
            configured = response.optBoolean("ok", false),
            effectiveDate = response.optString("effective_date").ifBlank { null },
            isActiveToday = response.optBoolean("ok", false),
            studentToken = response.optString("student_token").ifBlank { studentToken?.trim() }
        )
    }

    suspend fun getProctorPinStatus(studentToken: String? = null): ProctorPinStatusResponse? {
        val encodedToken = studentToken?.trim()?.takeIf { it.isNotBlank() }?.let { "&student_token=${urlEncode(it)}" } ?: ""
        val path = "/session/proctor-pin/status?session_id=${urlEncode(SessionState.sessionId)}$encodedToken"
        val response = getJson(path, bearerToken = SessionState.accessSignature) ?: return null
        return ProctorPinStatusResponse(
            configured = response.optBoolean("configured", false),
            effectiveDate = response.optString("effective_date").ifBlank { null },
            isActiveToday = response.optBoolean("is_active_today", false),
            studentToken = response.optString("student_token").ifBlank { studentToken?.trim() }
        )
    }

    suspend fun verifyProctorPin(pin: String): ProctorPinVerifyResponse? {
        val body = JSONObject()
            .put("session_id", SessionState.sessionId)
            .put("access_signature", SessionState.accessSignature)
            .put("pin", pin.trim())
        val response = postJson("/session/proctor-pin/verify", body) ?: return null
        return ProctorPinVerifyResponse(
            valid = response.optBoolean("valid", false),
            reason = response.optString("reason").ifBlank { null },
            effectiveDate = response.optString("effective_date").ifBlank { null }
        )
    }

    suspend fun ensureAdminControlSession(): Boolean {
        val hasAuth = SessionState.sessionId.isNotBlank() && SessionState.accessSignature.isNotBlank()
        if (hasAuth && SessionState.currentRole == UserRole.ADMIN) {
            val status = getProctorPinStatus()
            if (status != null) return true

            val refreshed = reconnectSession("ADMIN_SIGNATURE_REFRESH")
            val refreshedSignature = refreshed?.accessSignature?.takeIf { it.isNotBlank() }
            if (refreshed?.accepted == true && refreshedSignature != null) {
                SessionState.rotateAccessSignature(refreshedSignature)
                val retryStatus = getProctorPinStatus()
                if (retryStatus != null) return true
            }
            return false
        }

        val controlSession = createSessionBundle(
            proctorId = TestConstants.ADMIN_TOKEN,
            tokenTtlMinutes = TestConstants.DEFAULT_TOKEN_EXPIRY_MINUTES,
            tokenCount = 1
        ) ?: return false

        val controlToken = controlSession.tokens.firstOrNull { it.startsWith("A-") }
            ?: controlSession.tokens.firstOrNull()
            ?: controlSession.token
            ?: return false
        val claim = claimSession(controlToken, roleHint = "admin") ?: return false

        SessionState.startSession(
            token = TestConstants.ADMIN_TOKEN,
            role = UserRole.ADMIN,
            sessionExpiresAtMillis = claim.tokenExpiresAtMillis,
            serverSessionId = claim.sessionId,
            signature = claim.accessSignature,
            bindingId = claim.deviceBindingId
        )
        return true
    }

    private fun deviceBindingId(): String {
        val prefs = context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
        val existing = prefs.getString(TestConstants.PREF_DEVICE_BINDING_ID, null)
        if (!existing.isNullOrBlank()) return existing
        val created = UUID.randomUUID().toString()
        prefs.edit().putString(TestConstants.PREF_DEVICE_BINDING_ID, created).apply()
        return created
    }

    private fun normalizeBaseUrl(rawValue: String): String {
        val normalized = TestUtils.normalizeUrl(rawValue).trimEnd('/')
        val baseUrl = if (normalized.isBlank()) {
            TestConstants.SERVER_BASE_URL
        } else {
            normalized
        }
        if (!BuildConfig.DEV_TOOLS_ENABLED && baseUrl.startsWith("http://")) {
            return baseUrl.replaceFirst("http://", "https://")
        }
        return baseUrl
    }

    private fun urlEncode(value: String): String {
        return URLEncoder.encode(value, Charsets.UTF_8.name())
    }

    private fun parseIsoMillis(raw: String): Long? {
        return runCatching { Instant.parse(raw).toEpochMilli() }.getOrNull()
    }

    private fun hasConfiguredTlsPin(): Boolean {
        val host = TestConstants.TLS_PIN_HOST.trim()
        val pin = TestConstants.TLS_PIN_SHA256.trim()
        if (host.isBlank() || !pin.startsWith("sha256/")) {
            return false
        }
        val value = pin.removePrefix("sha256/")
        return value.isNotBlank() && value != "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    }
}

private fun JSONArray?.toStringList(): List<String> {
    if (this == null) return emptyList()
    val output = mutableListOf<String>()
    for (i in 0 until length()) {
        val value = optString(i).trim()
        if (value.isNotBlank()) output.add(value)
    }
    return output
}
