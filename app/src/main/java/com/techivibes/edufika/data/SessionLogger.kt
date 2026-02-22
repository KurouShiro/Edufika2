package com.techivibes.edufika.data

import android.content.Context
import com.techivibes.edufika.backend.SessionClient
import com.techivibes.edufika.utils.TestConstants
import com.techivibes.edufika.utils.TestUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.File

class SessionLogger(private val context: Context) {

    private val prefs = context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
    private val sessionClient by lazy { SessionClient(context) }
    private val ioScope = CoroutineScope(Dispatchers.IO)

    fun append(type: String, detail: String) {
        val line = "[${TestUtils.timestampNow()}] [$type] $detail"
        val current = prefs.getString(TestConstants.PREF_SESSION_LOGS, "") ?: ""
        val updated = if (current.isBlank()) line else "$line\n$current"
        prefs.edit().putString(TestConstants.PREF_SESSION_LOGS, updated).apply()
        appendToFile(line)

        val eventType = toServerEventType(type)
        if (
            eventType != null &&
            SessionState.currentRole != UserRole.NONE &&
            SessionState.sessionId.isNotBlank()
        ) {
            ioScope.launch {
                val sent = sessionClient.sendViolationEvent(eventType, detail, SessionState.riskScore)
                if (!sent) {
                    OfflineTelemetryStore.enqueueEvent(
                        context = context,
                        eventType = eventType,
                        detail = detail,
                        riskScore = SessionState.riskScore
                    )
                }
            }
        }
    }

    fun getAll(): List<String> {
        val raw = prefs.getString(TestConstants.PREF_SESSION_LOGS, "") ?: ""
        return raw.lines().filter { it.isNotBlank() }
    }

    fun clear() {
        prefs.edit().remove(TestConstants.PREF_SESSION_LOGS).apply()
        runCatching { loggerFile().writeText("", Charsets.UTF_8) }
    }

    fun getLogFilePath(): String {
        return loggerFile().absolutePath
    }

    private fun appendToFile(line: String) {
        runCatching {
            val file = loggerFile()
            file.parentFile?.mkdirs()
            file.appendText("$line\n", Charsets.UTF_8)
        }
    }

    private fun loggerFile(): File {
        val externalDir = context.getExternalFilesDir(null)
        val baseDir = externalDir ?: context.filesDir
        return File(baseDir, TestConstants.LOGGER_FILE_NAME)
    }

    private fun toServerEventType(type: String): String? {
        return when (type) {
            TestConstants.EVENT_APP_BACKGROUND,
            TestConstants.EVENT_OVERLAY_DETECTED,
            TestConstants.EVENT_ACCESSIBILITY_ACTIVE,
            TestConstants.EVENT_NETWORK_DROP,
            TestConstants.EVENT_POWER_WARNING,
            TestConstants.EVENT_RESTART_RECOVERY,
            TestConstants.EVENT_OFFLINE_HEARTBEAT_SYNC,
            TestConstants.EVENT_REPEATED_VIOLATION,
            TestConstants.EVENT_MULTI_WINDOW,
            TestConstants.EVENT_FOCUS_LOST,
            TestConstants.EVENT_MEDIA_PROJECTION_ATTEMPT -> type
            "VIOLATION", "BLOCK" -> TestConstants.EVENT_REPEATED_VIOLATION
            else -> null
        }
    }
}
