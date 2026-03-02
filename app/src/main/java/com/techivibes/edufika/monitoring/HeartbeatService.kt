package com.techivibes.edufika.monitoring

import android.app.Service
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.IBinder
import com.techivibes.edufika.backend.HeartbeatPayload
import com.techivibes.edufika.backend.SessionClient
import com.techivibes.edufika.data.OfflineTelemetryStore
import com.techivibes.edufika.data.SessionLogger
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.ui.UrlWhitelistStore
import com.techivibes.edufika.utils.TestConstants
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import kotlin.math.max

class HeartbeatService : Service() {

    private val serviceScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var loopJob: Job? = null
    private lateinit var sessionClient: SessionClient
    private lateinit var sessionLogger: SessionLogger
    private var reportedOverlayRisk = false
    private var reportedAccessibilityRisk = false
    private var reportedDebuggerRisk = false
    private var reportedEmulatorRisk = false
    private var reportedRootRisk = false
    private var powerWarningReported = false
    private var consecutiveFailures = 0
    private var offlineGraceAnnounced = false

    override fun onCreate() {
        super.onCreate()
        sessionClient = SessionClient(this)
        sessionLogger = SessionLogger(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (loopJob?.isActive != true) {
            loopJob = serviceScope.launch { heartbeatLoop() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        loopJob?.cancel()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private suspend fun heartbeatLoop() {
        while (serviceScope.isActive) {
            if (!SessionState.isStudentSessionActive()) {
                delay(TestConstants.HEARTBEAT_INTERVAL_MILLIS)
                continue
            }
            if (!isViolationSystemEnabled()) {
                sendStatus("monitoring_disabled_by_developer", "DISABLED")
                delay(TestConstants.HEARTBEAT_INTERVAL_MILLIS)
                continue
            }

            val integrityReport = IntegrityCheck.evaluate()
            val overlayDetectedNow = FocusMonitorState.overlayRiskDetected
            val accessibilityDetectedNow = FocusMonitorState.accessibilityRiskDetected
            val debuggerDetectedNow = integrityReport.debugger
            val emulatorDetectedNow = integrityReport.emulator
            val rootedDetectedNow = integrityReport.rooted

            val overlayEvent = overlayDetectedNow && !reportedOverlayRisk
            val accessibilityEvent = accessibilityDetectedNow && !reportedAccessibilityRisk
            val debuggerEvent = debuggerDetectedNow && !reportedDebuggerRisk
            val emulatorEvent = emulatorDetectedNow && !reportedEmulatorRisk
            val rootedEvent = rootedDetectedNow && !reportedRootRisk
            val networkState = resolveNetworkState()
            val heartbeatSeq = SessionState.nextHeartbeatSequence()

            val payload = HeartbeatPayload(
                focus = FocusMonitorState.hasWindowFocus,
                multiWindow = FocusMonitorState.isMultiWindow,
                networkState = networkState,
                deviceState = if (integrityReport.rooted || integrityReport.emulator || integrityReport.debugger) {
                    "risk"
                } else {
                    "normal"
                },
                timestamp = System.currentTimeMillis(),
                heartbeatSeq = heartbeatSeq,
                riskScore = max(SessionState.riskScore, integrityReport.score),
                overlayDetected = overlayEvent,
                accessibilityActive = accessibilityEvent,
                debugDetected = debuggerEvent,
                emulatorDetected = emulatorEvent,
                rooted = rootedEvent
            )

            val response = sessionClient.sendHeartbeat(payload)
            if (response != null) {
                consecutiveFailures = 0
                offlineGraceAnnounced = false
                SessionState.markHeartbeatNow()
                response.rotateSignature?.let { SessionState.rotateAccessSignature(it) }
                if (response.whitelist.isNotEmpty()) {
                    UrlWhitelistStore.replaceAll(this, response.whitelist.toSet())
                }
                reportedOverlayRisk = overlayDetectedNow
                reportedAccessibilityRisk = accessibilityDetectedNow
                reportedDebuggerRisk = debuggerDetectedNow
                reportedEmulatorRisk = emulatorDetectedNow
                reportedRootRisk = rootedDetectedNow
                maybeReportPowerWarning()
                flushOfflineTelemetry()
                sendStatus("heartbeat_ok: ${response.message}", response.sessionState)
                if (response.lock) {
                    sendLock("HeartbeatService: session dikunci oleh server.")
                } else if (response.sessionState == "SUSPENDED") {
                    sendStatus("session suspended, attempting reconnect", response.sessionState)
                    tryReconnect("SERVER_SUSPENDED")
                } else if (response.sessionState == "PAUSED") {
                    sendStatus("session paused by proctor", response.sessionState)
                } else if (SessionState.isStudentExamSessionActive() && SessionState.riskLocked()) {
                    sendLock("HeartbeatService: local risk threshold reached.")
                }
            } else {
                consecutiveFailures += 1
                OfflineTelemetryStore.enqueueHeartbeatSnapshot(this, heartbeatPayloadToJson(payload))
                OfflineTelemetryStore.enqueueEvent(
                    context = this,
                    eventType = TestConstants.EVENT_NETWORK_DROP,
                    detail = "Heartbeat gagal terkirim.",
                    riskScore = SessionState.riskScore
                )

                val staleMillis = System.currentTimeMillis() - SessionState.lastHeartbeatMillis
                val examActive = SessionState.isStudentExamSessionActive()
                val suspiciousWhileOffline =
                    !FocusMonitorState.hasWindowFocus ||
                        FocusMonitorState.isMultiWindow
                when {
                    staleMillis >= HEARTBEAT_HARD_LOCK_MILLIS -> {
                        if (examActive) {
                            sendLock("HeartbeatService: koneksi terputus melebihi offline grace window, sesi dikunci.")
                        } else {
                            sendStatus("heartbeat_failed: offline_grace_active", "OFFLINE_GRACE")
                        }
                    }
                    staleMillis >= TestConstants.HEARTBEAT_LOCK_MILLIS -> {
                        if (examActive && suspiciousWhileOffline) {
                            sendLock("HeartbeatService: offline + sinyal risiko terdeteksi, sesi dikunci.")
                        } else {
                            if (!offlineGraceAnnounced) {
                                sendStatus("heartbeat_failed: offline_grace_active", "OFFLINE_GRACE")
                                offlineGraceAnnounced = true
                            }
                            tryReconnect("OFFLINE_GRACE")
                        }
                    }
                    staleMillis >= TestConstants.HEARTBEAT_SUSPEND_MILLIS -> {
                        offlineGraceAnnounced = false
                        sendStatus("heartbeat_failed: suspended_window", "SUSPENDED")
                        tryReconnect("SUSPEND_WINDOW")
                    }
                    staleMillis >= TestConstants.HEARTBEAT_TIMEOUT_MILLIS -> {
                        offlineGraceAnnounced = false
                        sendStatus("heartbeat_failed: degraded_window", "DEGRADED")
                    }
                    else -> {
                        offlineGraceAnnounced = false
                        sendStatus("heartbeat_failed", "ACTIVE")
                    }
                }

                if (consecutiveFailures >= 3) {
                    tryReconnect("CONSECUTIVE_FAILURES")
                }
            }

            delay(TestConstants.HEARTBEAT_INTERVAL_MILLIS)
        }
    }

    private suspend fun tryReconnect(reason: String) {
        val reconnect = sessionClient.reconnectSession(reason) ?: return
        if (!reconnect.accepted || reconnect.accessSignature.isNullOrBlank()) return
        offlineGraceAnnounced = false
        SessionState.rotateAccessSignature(reconnect.accessSignature)
        SessionState.markHeartbeatNow()
        if (reconnect.whitelist.isNotEmpty()) {
            UrlWhitelistStore.replaceAll(this, reconnect.whitelist.toSet())
        }
        flushOfflineTelemetry()
        sessionLogger.append(TestConstants.EVENT_RESTART_RECOVERY, "Reconnect berhasil: $reason (${reconnect.sessionState})")
        sendStatus("reconnect_ok: ${reconnect.message}", reconnect.sessionState)
    }

    private suspend fun flushOfflineTelemetry() {
        val queuedEvents = OfflineTelemetryStore.readEvents(this, limit = 20)
        var sentEvents = 0
        for (item in queuedEvents) {
            val eventType = item.optString("event_type").trim()
            if (eventType.isBlank()) {
                sentEvents += 1
                continue
            }
            val detail = item.optString("detail", "")
            val riskScore = item.optInt("risk_score", SessionState.riskScore)
            val metadata = item.optJSONObject("metadata")
            val sent = sessionClient.sendViolationEvent(eventType, detail, riskScore, metadata)
            if (!sent) break
            sentEvents += 1
        }
        if (sentEvents > 0) {
            OfflineTelemetryStore.dropEvents(this, sentEvents)
        }

        val queuedHeartbeats = OfflineTelemetryStore.readHeartbeats(this, limit = 10)
        var sentHeartbeats = 0
        for (item in queuedHeartbeats) {
            val metadata = JSONObject()
                .put("queued_at", item.optLong("timestamp", 0L))
                .put("payload", item.optJSONObject("payload"))
            val sent = sessionClient.sendViolationEvent(
                type = TestConstants.EVENT_OFFLINE_HEARTBEAT_SYNC,
                detail = "Sinkronisasi heartbeat offline",
                riskScore = SessionState.riskScore,
                metadata = metadata
            )
            if (!sent) break
            sentHeartbeats += 1
        }
        if (sentHeartbeats > 0) {
            OfflineTelemetryStore.dropHeartbeats(this, sentHeartbeats)
        }
    }

    private fun resolveNetworkState(): String {
        val manager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = manager.activeNetwork ?: return "offline"
        val caps = manager.getNetworkCapabilities(network) ?: return "offline"
        val hasTransport = caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        if (!hasTransport) return "offline"
        return if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) {
            "stable"
        } else {
            "unstable"
        }
    }

    private fun heartbeatPayloadToJson(payload: HeartbeatPayload): JSONObject {
        return JSONObject()
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
    }

    private suspend fun maybeReportPowerWarning() {
        val battery = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return
        val level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        if (level <= 0 || scale <= 0) return
        val percent = ((level * 100f) / scale).toInt()
        val status = battery.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        if (percent >= 20 || charging) {
            powerWarningReported = false
            return
        }
        if (powerWarningReported) return

        val sent = sessionClient.sendViolationEvent(
            type = TestConstants.EVENT_POWER_WARNING,
            detail = "Baterai rendah saat ujian ($percent%)",
            riskScore = SessionState.riskScore
        )
        if (!sent) {
            OfflineTelemetryStore.enqueueEvent(
                context = this,
                eventType = TestConstants.EVENT_POWER_WARNING,
                detail = "Baterai rendah saat ujian ($percent%)",
                riskScore = SessionState.riskScore
            )
        }
        powerWarningReported = true
    }

    private fun sendLock(reason: String) {
        val intent = Intent(TestConstants.ACTION_SESSION_LOCKED)
            .putExtra(TestConstants.EXTRA_LOCK_REASON, reason)
        sendBroadcast(intent)
    }

    private fun sendStatus(message: String, state: String = "ACTIVE") {
        val intent = Intent(TestConstants.ACTION_HEARTBEAT_STATUS)
            .putExtra(TestConstants.EXTRA_HEARTBEAT_MESSAGE, message)
            .putExtra(TestConstants.EXTRA_HEARTBEAT_STATE, state)
        sendBroadcast(intent)
    }

    private fun isViolationSystemEnabled(): Boolean {
        return getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE).getBoolean(
            TestConstants.PREF_VIOLATION_SYSTEM_ENABLED,
            true
        )
    }

    companion object {
        private const val HEARTBEAT_HARD_LOCK_MILLIS = 20 * 60 * 1000L

        fun start(context: android.content.Context) {
            context.startService(Intent(context, HeartbeatService::class.java))
        }

        fun stop(context: android.content.Context) {
            context.stopService(Intent(context, HeartbeatService::class.java))
        }
    }
}
