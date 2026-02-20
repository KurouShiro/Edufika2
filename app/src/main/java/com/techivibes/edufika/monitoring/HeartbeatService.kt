package com.techivibes.edufika.monitoring

import android.app.Service
import android.content.Intent
import android.os.IBinder
import com.techivibes.edufika.backend.HeartbeatPayload
import com.techivibes.edufika.backend.SessionClient
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
import kotlin.math.max

class HeartbeatService : Service() {

    private val serviceScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var loopJob: Job? = null
    private lateinit var sessionClient: SessionClient
    private var reportedOverlayRisk = false
    private var reportedAccessibilityRisk = false
    private var reportedDebuggerRisk = false
    private var reportedEmulatorRisk = false
    private var reportedRootRisk = false

    override fun onCreate() {
        super.onCreate()
        sessionClient = SessionClient(this)
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

            val payload = HeartbeatPayload(
                focus = FocusMonitorState.hasWindowFocus,
                multiWindow = FocusMonitorState.isMultiWindow,
                deviceState = if (integrityReport.rooted || integrityReport.emulator || integrityReport.debugger) {
                    "risk"
                } else {
                    "normal"
                },
                timestamp = System.currentTimeMillis(),
                riskScore = max(SessionState.riskScore, integrityReport.score),
                overlayDetected = overlayEvent,
                accessibilityActive = accessibilityEvent,
                debugDetected = debuggerEvent,
                emulatorDetected = emulatorEvent,
                rooted = rootedEvent
            )

            val response = sessionClient.sendHeartbeat(payload)
            if (response != null) {
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
                sendStatus("heartbeat_ok: ${response.message}")
                if (response.lock) {
                    sendLock("HeartbeatService: session dikunci oleh server.")
                } else if (SessionState.riskLocked()) {
                    sendLock("HeartbeatService: local risk threshold reached.")
                }
            } else {
                SessionState.registerRiskEvent(TestConstants.EVENT_NETWORK_DROP)
                sendStatus("heartbeat_failed")
                if (SessionState.heartbeatTimedOut()) {
                    sendLock("HeartbeatService: timeout >30 detik.")
                }
            }

            delay(TestConstants.HEARTBEAT_INTERVAL_MILLIS)
        }
    }

    private fun sendLock(reason: String) {
        val intent = Intent(TestConstants.ACTION_SESSION_LOCKED)
            .putExtra(TestConstants.EXTRA_LOCK_REASON, reason)
        sendBroadcast(intent)
    }

    private fun sendStatus(message: String) {
        val intent = Intent(TestConstants.ACTION_HEARTBEAT_STATUS)
            .putExtra(TestConstants.EXTRA_HEARTBEAT_MESSAGE, message)
        sendBroadcast(intent)
    }

    companion object {
        fun start(context: android.content.Context) {
            context.startService(Intent(context, HeartbeatService::class.java))
        }

        fun stop(context: android.content.Context) {
            context.stopService(Intent(context, HeartbeatService::class.java))
        }
    }
}
