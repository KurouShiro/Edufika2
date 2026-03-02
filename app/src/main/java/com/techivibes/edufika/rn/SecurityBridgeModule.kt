package com.techivibes.edufika.rn

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.techivibes.edufika.ReactNativeHostActivity
import com.techivibes.edufika.data.SessionLogger
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.data.SessionStateStore
import com.techivibes.edufika.data.UserRole
import com.techivibes.edufika.monitoring.HeartbeatService
import com.techivibes.edufika.security.ScreenLock
import com.techivibes.edufika.security.ScreenOffReceiver
import com.techivibes.edufika.security.WindowModeDetector
import com.techivibes.edufika.security.WindowViolationGuard
import com.techivibes.edufika.utils.TestConstants
import java.util.UUID

class SecurityBridgeModule(
    private val appContext: ReactApplicationContext
) : ReactContextBaseJavaModule(appContext), LifecycleEventListener, ActivityEventListener {

    companion object {
        const val MODULE_NAME = "EdufikaSecurity"
        const val EVENT_SESSION_LOCKED = "EdufikaSessionLocked"
        const val EVENT_HEARTBEAT_STATUS = "EdufikaHeartbeatStatus"
        private const val REQUEST_CODE_CAMERAX_QR_SCANNER = 44201
        private const val PIN_ENTRY_FOCUS_BYPASS_WINDOW_MS = 12_000L
        private const val MULTI_WINDOW_LOCK_REASON =
            "Multi-window/split-screen terdeteksi saat sesi siswa aktif."
        private const val MULTI_WINDOW_RECHECK_DELAY_MS = 450L
        private const val LOCK_EVENT_DEDUPE_WINDOW_MS = 2_000L
    }

    private var receiversRegistered = false
    private var pendingLockReason: String? = null
    private var pendingQrScanPromise: Promise? = null
    private var lastLockReason: String = ""
    private var lastLockAtMs: Long = 0L
    private val sessionLogger: SessionLogger by lazy { SessionLogger(appContext) }
    private val mainHandler: Handler by lazy { Handler(Looper.getMainLooper()) }
    private val windowViolationGuard = WindowViolationGuard()
    private val prefs by lazy {
        appContext.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
    }

    private val sessionLockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (!isViolationSystemEnabled()) {
                sessionLogger.append("VIOLATION", "Session lock broadcast ignored: violation system disabled.")
                return
            }
            if (!SessionState.isStudentExamSessionActive()) {
                sessionLogger.append(
                    "VIOLATION",
                    "Session lock broadcast ignored outside active exam session."
                )
                return
            }
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
            if (!isViolationSystemEnabled()) {
                return
            }
            if (currentActivity is ReactNativeHostActivity) {
                // ReactNativeHostActivity already runs its own screen-off detector.
                return
            }
            if (!SessionState.isStudentExamSessionActive()) {
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
        appContext.addActivityEventListener(this)
        registerReceivers()
    }

    override fun invalidate() {
        appContext.removeLifecycleEventListener(this)
        appContext.removeActivityEventListener(this)
        pendingQrScanPromise = null
        mainHandler.removeCallbacksAndMessages(null)
        windowViolationGuard.reset()
        unregisterReceivers()
        super.invalidate()
    }

    override fun onHostResume() {
        val pending = pendingLockReason
        if (pending != null) {
            val emitted = emitEventIfActive(
                EVENT_SESSION_LOCKED,
                Arguments.createMap().apply { putString("reason", pending) }
            )
            if (emitted) {
                pendingLockReason = null
            }
        }
        enforceActiveSessionWindowPolicy("onHostResume")
    }

    override fun onHostPause() = Unit

    override fun onHostDestroy() = Unit

    @ReactMethod
    fun getKioskEnabled(promise: Promise) {
        runCatching {
            val enabled = prefs.getBoolean(TestConstants.PREF_APP_LOCK_ENABLED, true)
            promise.resolve(enabled)
        }.onFailure { error ->
            promise.reject("kiosk_read_failed", error)
        }
    }

    @ReactMethod
    fun getViolationSystemEnabled(promise: Promise) {
        runCatching {
            promise.resolve(isViolationSystemEnabled())
        }.onFailure { error ->
            promise.reject("violation_system_read_failed", error)
        }
    }

    @ReactMethod
    fun getSplitScreenDetectionEnabled(promise: Promise) {
        runCatching {
            promise.resolve(isSplitScreenDetectionEnabled())
        }.onFailure { error ->
            promise.reject("split_screen_detection_read_failed", error)
        }
    }

    @ReactMethod
    fun getDeviceFingerprint(promise: Promise) {
        runCatching {
            val androidId = Settings.Secure.getString(
                appContext.contentResolver,
                Settings.Secure.ANDROID_ID
            )?.trim().orEmpty()
            val manufacturer = Build.MANUFACTURER?.trim().orEmpty()
            val model = Build.MODEL?.trim().orEmpty()
            val fingerprint = listOf("edufika", manufacturer, model, androidId)
                .joinToString("|")
                .ifBlank { "edufika|unknown-device" }
            promise.resolve(fingerprint)
        }.onFailure { error ->
            promise.reject("device_fingerprint_failed", error)
        }
    }

    @ReactMethod
    fun setKioskEnabled(enabled: Boolean) {
        prefs.edit()
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
    fun setViolationSystemEnabled(enabled: Boolean) {
        prefs.edit()
            .putBoolean(TestConstants.PREF_VIOLATION_SYSTEM_ENABLED, enabled)
            .apply()
        if (!enabled) {
            pendingLockReason = null
            ScreenOffReceiver.stopAlarm()
            HeartbeatService.stop(appContext)
            sessionLogger.append("SECURITY", "Violation system disabled by developer.")
        } else {
            sessionLogger.append("SECURITY", "Violation system enabled by developer.")
        }
    }

    @ReactMethod
    fun setSplitScreenDetectionEnabled(enabled: Boolean) {
        prefs.edit()
            .putBoolean(TestConstants.PREF_SPLIT_SCREEN_DETECTION_ENABLED, enabled)
            .apply()
        sessionLogger.append(
            "SECURITY",
            if (enabled) {
                "Split-screen detection enabled by developer."
            } else {
                "Split-screen detection disabled by developer."
            }
        )
    }

    @ReactMethod
    fun getAdminWorkspaceCache(promise: Promise) {
        runCatching {
            promise.resolve(prefs.getString(TestConstants.PREF_ADMIN_WORKSPACE_CACHE, "") ?: "")
        }.onFailure { error ->
            promise.reject("admin_workspace_cache_read_failed", error)
        }
    }

    @ReactMethod
    fun setAdminWorkspaceCache(value: String) {
        prefs.edit()
            .putString(TestConstants.PREF_ADMIN_WORKSPACE_CACHE, value)
            .apply()
    }

    @ReactMethod
    fun clearAdminWorkspaceCache() {
        prefs.edit()
            .remove(TestConstants.PREF_ADMIN_WORKSPACE_CACHE)
            .apply()
    }

    @ReactMethod
    fun setPinEntryFocusBypass(enabled: Boolean) {
        val until = if (enabled) {
            System.currentTimeMillis() + PIN_ENTRY_FOCUS_BYPASS_WINDOW_MS
        } else {
            0L
        }
        prefs.edit()
            .putLong(TestConstants.PREF_PIN_ENTRY_FOCUS_BYPASS_UNTIL, until)
            .apply()
    }

    @ReactMethod
    fun syncStudentSession(
        token: String,
        sessionId: String,
        accessSignature: String,
        deviceBindingId: String,
        expiresAtMillis: Double,
        examUrl: String,
        examModeActive: Boolean
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
        SessionState.setExamModeActive(examModeActive)
        SessionStateStore.persist()

        // If split-screen was already open before app launch, lock immediately on session activation.
        mainHandler.post { enforceActiveSessionWindowPolicy("syncStudentSession") }
        mainHandler.postDelayed(
            { enforceActiveSessionWindowPolicy("syncStudentSessionDelayed") },
            MULTI_WINDOW_RECHECK_DELAY_MS
        )
    }

    @ReactMethod
    fun clearSession() {
        SessionState.clear()
        SessionStateStore.clear()
        mainHandler.removeCallbacksAndMessages(null)
        windowViolationGuard.reset()
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
    fun checkAndLockIfMultiWindow(promise: Promise) {
        UiThreadUtil.runOnUiThread {
            promise.resolve(enforceActiveSessionWindowPolicy("checkAndLockIfMultiWindow"))
        }
    }

    @ReactMethod
    fun openCameraXQrScanner(promise: Promise) {
        if (pendingQrScanPromise != null) {
            promise.reject("qr_scanner_busy", "CameraX QR scanner is already active.")
            return
        }
        val activity = currentActivity
        if (activity == null) {
            promise.reject("qr_scanner_unavailable", "No active activity for CameraX QR scanner.")
            return
        }
        pendingQrScanPromise = promise
        runCatching {
            val intent = Intent(activity, CameraXQrScannerActivity::class.java)
            activity.startActivityForResult(intent, REQUEST_CODE_CAMERAX_QR_SCANNER)
        }.onFailure { error ->
            pendingQrScanPromise = null
            promise.reject("qr_scanner_launch_failed", error)
        }
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

    override fun onActivityResult(
        activity: Activity?,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != REQUEST_CODE_CAMERAX_QR_SCANNER) {
            return
        }
        val promise = pendingQrScanPromise ?: return
        pendingQrScanPromise = null

        if (resultCode != Activity.RESULT_OK) {
            promise.reject("qr_scanner_cancelled", "CameraX QR scanner cancelled.")
            return
        }

        val value = data?.getStringExtra(CameraXQrScannerActivity.EXTRA_QR_VALUE)
            ?.trim()
            .orEmpty()
        if (value.isBlank()) {
            promise.reject("qr_scanner_empty", "No QR value returned by CameraX scanner.")
            return
        }
        promise.resolve(value)
    }

    override fun onNewIntent(intent: Intent?) = Unit

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
        if (!isViolationSystemEnabled()) {
            return
        }
        val nowMs = SystemClock.elapsedRealtime()
        if (lastLockReason == reason && nowMs - lastLockAtMs < LOCK_EVENT_DEDUPE_WINDOW_MS) {
            sessionLogger.append("VIOLATION", "Duplicate lock event suppressed: $reason")
            return
        }
        lastLockReason = reason
        lastLockAtMs = nowMs
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

    private fun enforceActiveSessionWindowPolicy(source: String): Boolean {
        if (!isViolationSystemEnabled() || !isSplitScreenDetectionEnabled()) {
            return false
        }
        val snapshot = WindowModeDetector.capture(currentActivity)
        val decision = windowViolationGuard.evaluate(
            snapshot = snapshot,
            examActive = SessionState.isStudentExamSessionActive()
        )
        if (!decision.shouldLock) {
            return false
        }

        SessionState.registerRiskEvent(TestConstants.EVENT_MULTI_WINDOW)
        sessionLogger.append(
            TestConstants.EVENT_MULTI_WINDOW,
            "$MULTI_WINDOW_LOCK_REASON source=$source ${snapshot.summary()} ${decision.summary()}"
        )
        ScreenOffReceiver.triggerAlarm(appContext)
        broadcastSessionLock(MULTI_WINDOW_LOCK_REASON)
        return true
    }

    private fun isViolationSystemEnabled(): Boolean {
        return prefs.getBoolean(TestConstants.PREF_VIOLATION_SYSTEM_ENABLED, true)
    }

    private fun isSplitScreenDetectionEnabled(): Boolean {
        return prefs.getBoolean(TestConstants.PREF_SPLIT_SCREEN_DETECTION_ENABLED, true)
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
