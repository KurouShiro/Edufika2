package com.techivibes.edufika.rn

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.techivibes.edufika.data.SessionLogger
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.data.SessionStateStore
import com.techivibes.edufika.data.UserRole
import com.techivibes.edufika.monitoring.HeartbeatService
import com.techivibes.edufika.security.ScreenLock
import com.techivibes.edufika.security.ScreenOffReceiver
import com.techivibes.edufika.utils.TestConstants
import java.util.UUID

class SecurityBridgeModule(
    private val appContext: ReactApplicationContext
) : ReactContextBaseJavaModule(appContext), LifecycleEventListener {

    companion object {
        const val MODULE_NAME = "EdufikaSecurity"
        const val EVENT_SESSION_LOCKED = "EdufikaSessionLocked"
        const val EVENT_HEARTBEAT_STATUS = "EdufikaHeartbeatStatus"
    }

    private var receiversRegistered = false
    private var pendingLockReason: String? = null
    private val sessionLogger: SessionLogger by lazy { SessionLogger(appContext) }

    private val sessionLockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val reason = intent?.getStringExtra(TestConstants.EXTRA_LOCK_REASON)
                ?.trim()
                ?.takeIf { it.isNotBlank() }
                ?: "Session dikunci oleh sistem keamanan."
            ScreenOffReceiver.triggerAlarm(appContext)
            dispatchSessionLock(reason)
        }
    }

    private val heartbeatReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val message = intent?.getStringExtra(TestConstants.EXTRA_HEARTBEAT_MESSAGE)
                ?.trim()
                ?.takeIf { it.isNotBlank() }
                ?: return
            val state = intent.getStringExtra(TestConstants.EXTRA_HEARTBEAT_STATE).orEmpty()
            emitEvent(
                EVENT_HEARTBEAT_STATUS,
                Arguments.createMap().apply {
                    putString("message", message)
                    putString("state", state)
                }
            )
        }
    }

    private val screenOffReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != Intent.ACTION_SCREEN_OFF) {
                return
            }
            if (!SessionState.isStudentSessionActive()) {
                return
            }
            val reason = "ScreenOffViolationTest: layar mati saat ujian aktif."
            SessionState.registerRiskEvent(TestConstants.EVENT_FOCUS_LOST)
            sessionLogger.append(TestConstants.EVENT_FOCUS_LOST, reason)
            broadcastSessionLock(reason)
        }
    }

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        appContext.addLifecycleEventListener(this)
        registerReceivers()
    }

    override fun invalidate() {
        appContext.removeLifecycleEventListener(this)
        unregisterReceivers()
        super.invalidate()
    }

    override fun onHostResume() {
        val pending = pendingLockReason ?: return
        val emitted = emitEventIfActive(
            EVENT_SESSION_LOCKED,
            Arguments.createMap().apply { putString("reason", pending) }
        )
        if (emitted) {
            pendingLockReason = null
        }
    }

    override fun onHostPause() = Unit

    override fun onHostDestroy() = Unit

    @ReactMethod
    fun getKioskEnabled(promise: Promise) {
        runCatching {
            val enabled = appContext
                .getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean(TestConstants.PREF_APP_LOCK_ENABLED, true)
            promise.resolve(enabled)
        }.onFailure { error ->
            promise.reject("kiosk_read_failed", error)
        }
    }

    @ReactMethod
    fun setKioskEnabled(enabled: Boolean) {
        appContext.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(TestConstants.PREF_APP_LOCK_ENABLED, enabled)
            .apply()

        val activity = currentActivity ?: return
        UiThreadUtil.runOnUiThread {
            if (enabled) {
                ScreenLock.apply(activity)
            } else {
                ScreenLock.clear(activity)
            }
        }
    }

    @ReactMethod
    fun syncStudentSession(
        token: String,
        sessionId: String,
        accessSignature: String,
        deviceBindingId: String,
        expiresAtMillis: Double,
        examUrl: String
    ) {
        val normalizedToken = token.trim()
        if (normalizedToken.isBlank()) {
            return
        }

        val normalizedSessionId = sessionId.trim().ifBlank { UUID.randomUUID().toString() }
        val normalizedSignature = accessSignature.trim().ifBlank {
            UUID.randomUUID().toString().replace("-", "")
        }
        val normalizedBinding = deviceBindingId.trim().ifBlank { UUID.randomUUID().toString() }
        val expiryAt = expiresAtMillis.toLong().takeIf { it > 0L }

        SessionState.startSession(
            token = normalizedToken,
            role = UserRole.STUDENT,
            sessionExpiresAtMillis = expiryAt,
            serverSessionId = normalizedSessionId,
            signature = normalizedSignature,
            bindingId = normalizedBinding
        )
        SessionState.setCurrentExamUrl(examUrl.trim())
        SessionStateStore.persist()
    }

    @ReactMethod
    fun clearSession() {
        SessionState.clear()
        SessionStateStore.clear()
        ScreenOffReceiver.stopAlarm()
    }

    @ReactMethod
    fun startHeartbeat() {
        HeartbeatService.start(appContext)
    }

    @ReactMethod
    fun stopHeartbeat() {
        HeartbeatService.stop(appContext)
    }

    @ReactMethod
    fun triggerViolationAlarm() {
        ScreenOffReceiver.triggerAlarm(appContext)
    }

    @ReactMethod
    fun stopViolationAlarm() {
        ScreenOffReceiver.stopAlarm()
    }

    @ReactMethod
    fun exitApp() {
        HeartbeatService.stop(appContext)
        ScreenOffReceiver.stopAlarm()
        val activity = currentActivity ?: return
        UiThreadUtil.runOnUiThread {
            ScreenLock.clear(activity)
            runCatching { activity.moveTaskToBack(true) }
            runCatching { activity.finishAffinity() }
            runCatching { activity.finishAndRemoveTask() }
        }
    }

    private fun registerReceivers() {
        if (receiversRegistered) return
        ContextCompat.registerReceiver(
            appContext,
            sessionLockReceiver,
            IntentFilter(TestConstants.ACTION_SESSION_LOCKED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        ContextCompat.registerReceiver(
            appContext,
            heartbeatReceiver,
            IntentFilter(TestConstants.ACTION_HEARTBEAT_STATUS),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        ContextCompat.registerReceiver(
            appContext,
            screenOffReceiver,
            IntentFilter(Intent.ACTION_SCREEN_OFF),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        receiversRegistered = true
    }

    private fun unregisterReceivers() {
        if (!receiversRegistered) return
        runCatching { appContext.unregisterReceiver(sessionLockReceiver) }
        runCatching { appContext.unregisterReceiver(heartbeatReceiver) }
        runCatching { appContext.unregisterReceiver(screenOffReceiver) }
        receiversRegistered = false
    }

    private fun dispatchSessionLock(reason: String) {
        val emitted = emitEventIfActive(
            EVENT_SESSION_LOCKED,
            Arguments.createMap().apply { putString("reason", reason) }
        )
        if (!emitted) {
            pendingLockReason = reason
        }
    }

    private fun broadcastSessionLock(reason: String) {
        appContext.sendBroadcast(
            Intent(TestConstants.ACTION_SESSION_LOCKED)
                .putExtra(TestConstants.EXTRA_LOCK_REASON, reason)
        )
    }

    private fun emitEvent(eventName: String, payload: WritableMap) {
        emitEventIfActive(eventName, payload)
    }

    private fun emitEventIfActive(eventName: String, payload: WritableMap): Boolean {
        if (!appContext.hasActiveReactInstance()) {
            return false
        }
        return runCatching {
            appContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, payload)
            true
        }.getOrDefault(false)
    }
}
