package com.techivibes.edufika

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.WindowManager
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.os.bundleOf
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.navigation.NavController
import androidx.navigation.NavOptions
import androidx.navigation.fragment.NavHostFragment
import com.techivibes.edufika.data.SessionLogger
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.data.SessionStateStore
import com.techivibes.edufika.data.UserRole
import com.techivibes.edufika.monitoring.FocusMonitor
import com.techivibes.edufika.monitoring.HeartbeatService
import com.techivibes.edufika.monitoring.IntegrityCheck
import com.techivibes.edufika.navigation.FragmentNavigationTest
import com.techivibes.edufika.security.BackgroundViolationTest
import com.techivibes.edufika.security.RestartViolationTest
import com.techivibes.edufika.security.ScreenLock
import com.techivibes.edufika.security.ScreenOffReceiver
import com.techivibes.edufika.security.ScreenOffViolationTest
import com.techivibes.edufika.security.WindowModeDetector
import com.techivibes.edufika.security.WindowViolationGuard
import com.techivibes.edufika.utils.TestConstants
import com.techivibes.edufika.utils.TestUtils

class MainActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_SKIP_RN_UI_BOOT = "extra_skip_rn_ui_boot"
        private const val PREF_RN_BOOT_PENDING = "pref_rn_boot_pending"
        private const val PREF_RN_BOOT_PENDING_AT = "pref_rn_boot_pending_at"
        private const val RN_BOOT_FAIL_WINDOW_MS = 20_000L
        private const val MULTI_WINDOW_LOCK_REASON =
            "Multi-window/split-screen terdeteksi. Sesi dikunci demi integritas ujian."
        private const val FOCUS_LOSS_LOCK_REASON =
            "Aplikasi kehilangan fokus saat sesi ujian aktif."
        private const val FOCUS_LOSS_LOCK_DELAY_MS = 800L
        private const val VIOLATION_DEDUPE_WINDOW_MS = 2_500L
    }

    private lateinit var navController: NavController
    private lateinit var backgroundViolationTest: BackgroundViolationTest
    private lateinit var screenOffViolationTest: ScreenOffViolationTest
    private lateinit var focusMonitor: FocusMonitor
    private lateinit var sessionLogger: SessionLogger
    private var receiversRegistered = false
    private val windowViolationGuard = WindowViolationGuard()
    private var focusLossLockPending = false
    private var lastViolationAtMs = 0L
    private var lastViolationMessage = ""
    private val sessionExpiryHandler = Handler(Looper.getMainLooper())
    private val focusLossHandler = Handler(Looper.getMainLooper())
    private var expiryDialogShown = false

    private val sessionExpiryRunnable = object : Runnable {
        override fun run() {
            if (SessionState.currentRole == UserRole.NONE) {
                expiryDialogShown = false
                sessionExpiryHandler.postDelayed(this, 1000L)
                return
            }

            if (SessionState.isSessionExpired() && !expiryDialogShown) {
                handleSessionExpired()
                return
            }
            sessionExpiryHandler.postDelayed(this, 1000L)
        }
    }

    private val sessionLockReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val reason = intent?.getStringExtra(TestConstants.EXTRA_LOCK_REASON)
                ?: "Server mengunci sesi karena heartbeat/risk."
            handleViolation(reason)
        }
    }

    private val heartbeatStatusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val message = intent?.getStringExtra(TestConstants.EXTRA_HEARTBEAT_MESSAGE) ?: return
            val state = intent.getStringExtra(TestConstants.EXTRA_HEARTBEAT_STATE).orEmpty()
            sessionLogger.append("HEARTBEAT", if (state.isBlank()) message else "$message | state=$state")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (shouldLaunchReactNativeUi()) {
            markRnBootPending()
            startActivity(Intent(this, ReactNativeHostActivity::class.java))
            finish()
            return
        }
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
        setContentView(R.layout.activity_main)
        sessionLogger = SessionLogger(this)

        val navHost =
            supportFragmentManager.findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        navController = navHost.navController
        SessionStateStore.restore()

        focusMonitor = FocusMonitor(this) { event, detail ->
            handleRiskEvent(event, detail)
        }
        focusMonitor.refreshSignals()
        applyIntegrityBaseline()

        val restartViolation = RestartViolationTest.checkAndMarkLaunch(this)
        if (restartViolation) {
            SessionStateStore.markRecoveryPending("APP_RESTART")
            sessionLogger.append("RECOVERY", "Aplikasi restart terdeteksi, menjalankan mode pemulihan sesi.")
        }
        restoreRecoveredSessionUi()

        backgroundViolationTest = BackgroundViolationTest {
            handleRiskEvent(
                TestConstants.EVENT_APP_BACKGROUND,
                "BackgroundViolationTest: aplikasi di-background saat ujian aktif."
            )
            handleViolation("BackgroundViolationTest: aplikasi di-background saat ujian aktif.")
        }
        ProcessLifecycleOwner.get().lifecycle.addObserver(backgroundViolationTest)

        screenOffViolationTest = ScreenOffViolationTest(this) {
            handleRiskEvent(
                TestConstants.EVENT_FOCUS_LOST,
                "ScreenOffViolationTest: layar mati saat ujian aktif."
            )
            handleViolation("ScreenOffViolationTest: layar mati saat ujian aktif.")
        }
        screenOffViolationTest.register()
        registerInternalReceivers()
        if (isViolationSystemEnabled()) {
            HeartbeatService.start(this)
        } else {
            HeartbeatService.stop(this)
        }
        resetKioskModeForNewLaunch()
        startSessionExpiryWatcher()

        if (isKioskModeEnabled()) {
            ScreenLock.apply(this)
        }
    }

    override fun onResume() {
        super.onResume()
        if (::focusMonitor.isInitialized) {
            focusMonitor.refreshSignals()
        }
        if (isViolationSystemEnabled()) {
            HeartbeatService.start(this)
        } else {
            HeartbeatService.stop(this)
        }
        startSessionExpiryWatcher()
        if (isKioskModeEnabled()) {
            ScreenLock.apply(this)
            if (isSplitScreenDetectionEnabled() && isViolationSystemEnabled()) {
                enforceSingleWindowMode("onResume")
            }
        }
    }

    override fun onDestroy() {
        if (::backgroundViolationTest.isInitialized) {
            ProcessLifecycleOwner.get().lifecycle.removeObserver(backgroundViolationTest)
        }
        if (::screenOffViolationTest.isInitialized) {
            screenOffViolationTest.unregister()
        }
        unregisterInternalReceivers()
        HeartbeatService.stop(this)
        clearFocusLossLockCheck()
        windowViolationGuard.reset()
        sessionExpiryHandler.removeCallbacks(sessionExpiryRunnable)
        RestartViolationTest.markCleanExit(this, isFinishing)
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (::focusMonitor.isInitialized) {
            focusMonitor.onWindowFocusChanged(hasFocus)
        }
        if (hasFocus) {
            clearFocusLossLockCheck()
            return
        }
        if (isKioskModeEnabled() && isViolationSystemEnabled() && isSplitScreenDetectionEnabled()) {
            scheduleFocusLossLockCheck("onWindowFocusChanged")
        }
    }

    override fun onMultiWindowModeChanged(isInMultiWindowMode: Boolean) {
        super.onMultiWindowModeChanged(isInMultiWindowMode)
        if (::focusMonitor.isInitialized) {
            focusMonitor.onMultiWindowModeChanged(isInMultiWindowMode)
        }
        if (
            isInMultiWindowMode &&
            isKioskModeEnabled() &&
            isViolationSystemEnabled() &&
            isSplitScreenDetectionEnabled()
        ) {
            enforceSingleWindowMode("onMultiWindowModeChanged")
        }
    }

    private fun registerInternalReceivers() {
        if (receiversRegistered) return
        ContextCompat.registerReceiver(
            this,
            sessionLockReceiver,
            IntentFilter(TestConstants.ACTION_SESSION_LOCKED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        ContextCompat.registerReceiver(
            this,
            heartbeatStatusReceiver,
            IntentFilter(TestConstants.ACTION_HEARTBEAT_STATUS),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        receiversRegistered = true
    }

    private fun unregisterInternalReceivers() {
        if (!receiversRegistered) return
        runCatching { unregisterReceiver(sessionLockReceiver) }
        runCatching { unregisterReceiver(heartbeatStatusReceiver) }
        receiversRegistered = false
    }

    private fun applyIntegrityBaseline() {
        val report = IntegrityCheck.evaluate()
        if (report.rooted || report.emulator || report.debugger) {
            sessionLogger.append(
                "INTEGRITY_WARN",
                "Baseline integrity signal recorded (telemetry-only): ${report.details}"
            )
        }
        sessionLogger.append("INTEGRITY", report.details)
    }

    private fun startSessionExpiryWatcher() {
        sessionExpiryHandler.removeCallbacks(sessionExpiryRunnable)
        sessionExpiryHandler.post(sessionExpiryRunnable)
    }

    private fun handleSessionExpired() {
        if (expiryDialogShown) return
        expiryDialogShown = true
        sessionLogger.append("SESSION", "Session token expired. App akan ditutup otomatis.")

        AlertDialog.Builder(this)
            .setTitle("Waktu Ujian Habis")
            .setMessage("Session token telah kadaluarsa. Aplikasi akan keluar otomatis.")
            .setCancelable(false)
            .setPositiveButton("OK") { _, _ ->
                SessionState.clear()
                TestUtils.shutdownApp(this, disableKioskForCurrentRun = true)
            }
            .show()

        sessionExpiryHandler.postDelayed({
            if (!isFinishing) {
                SessionState.clear()
                TestUtils.shutdownApp(this, disableKioskForCurrentRun = true)
            }
        }, 2500L)
    }

    private fun handleRiskEvent(event: String, detail: String) {
        if (!isViolationSystemEnabled()) return
        if (!SessionState.isStudentExamSessionActive()) return
        val score = SessionState.registerRiskEvent(event)
        sessionLogger.append(event, "$detail | score=$score")
        if (SessionState.riskLocked()) {
            handleViolation("Risk score threshold exceeded: $score")
        }
    }

    private fun handleViolation(message: String) {
        if (!isViolationSystemEnabled()) return
        if (!SessionState.isStudentExamSessionActive()) return
        val normalizedMessage = message.trim().ifBlank { "Unknown violation" }
        val nowMs = SystemClock.elapsedRealtime()
        if (
            lastViolationMessage == normalizedMessage &&
            nowMs - lastViolationAtMs < VIOLATION_DEDUPE_WINDOW_MS
        ) {
            sessionLogger.append("VIOLATION", "Duplicate violation suppressed: $normalizedMessage")
            return
        }
        lastViolationAtMs = nowMs
        lastViolationMessage = normalizedMessage
        SessionState.registerRiskEvent(TestConstants.EVENT_REPEATED_VIOLATION)
        sessionLogger.append("VIOLATION", normalizedMessage)
        ScreenOffReceiver.triggerAlarm(this)
        navigateViolation(normalizedMessage)
    }

    private fun enforceSingleWindowMode(source: String) {
        if (!isViolationSystemEnabled() || !isSplitScreenDetectionEnabled()) {
            return
        }
        val snapshot = WindowModeDetector.capture(this)
        val decision = windowViolationGuard.evaluate(
            snapshot = snapshot,
            examActive = SessionState.isStudentExamSessionActive()
        )
        if (!decision.shouldLock) {
            return
        }
        sessionLogger.append(
            "KIOSK",
            "Split-screen detected in native host ($source). Forcing lock. ${snapshot.summary()} ${decision.summary()}"
        )
        handleRiskEvent(
            TestConstants.EVENT_MULTI_WINDOW,
            "Force-close path: multi-window detected ($source). ${snapshot.summary()} ${decision.summary()}"
        )
        handleViolation(MULTI_WINDOW_LOCK_REASON)
        runCatching { ScreenLock.apply(this) }
    }

    private fun navigateViolation(message: String) {
        if (navController.currentDestination?.id == R.id.violationFragment) {
            return
        }
        navController.navigate(
            R.id.violationFragment,
            bundleOf(TestConstants.ARG_VIOLATION_MESSAGE to message),
            NavOptions.Builder().setLaunchSingleTop(true).build()
        )
    }

    private fun scheduleFocusLossLockCheck(source: String) {
        if (!isViolationSystemEnabled() || !isSplitScreenDetectionEnabled()) {
            return
        }
        if (focusLossLockPending || !SessionState.isStudentExamSessionActive()) {
            return
        }
        focusLossLockPending = true
        focusLossHandler.postDelayed(
            {
                focusLossLockPending = false
                if (hasWindowFocus() || !SessionState.isStudentExamSessionActive()) {
                    return@postDelayed
                }
                if (isPinEntryFocusBypassActive()) {
                    sessionLogger.append(
                        "KIOSK",
                        "Focus loss ignored due to active proctor PIN entry bypass. source=$source"
                    )
                    return@postDelayed
                }
                val snapshot = WindowModeDetector.capture(this)
                if (snapshot.imeVisible) {
                    sessionLogger.append(
                        "KIOSK",
                        "Focus loss ignored due to IME visibility in native host ($source). ${snapshot.summary()}"
                    )
                    return@postDelayed
                }
                sessionLogger.append(
                    "KIOSK",
                    "Focus loss sustained in native host ($source). Forcing lock. ${snapshot.summary()}"
                )
                handleRiskEvent(
                    TestConstants.EVENT_FOCUS_LOST,
                    "Sustained focus loss detected ($source). ${snapshot.summary()}"
                )
                handleViolation(FOCUS_LOSS_LOCK_REASON)
            },
            FOCUS_LOSS_LOCK_DELAY_MS
        )
    }

    private fun clearFocusLossLockCheck() {
        focusLossLockPending = false
        focusLossHandler.removeCallbacksAndMessages(null)
    }

    private fun isKioskModeEnabled(): Boolean {
        return getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE).getBoolean(
            TestConstants.PREF_APP_LOCK_ENABLED,
            true
        )
    }

    private fun isViolationSystemEnabled(): Boolean {
        return getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE).getBoolean(
            TestConstants.PREF_VIOLATION_SYSTEM_ENABLED,
            true
        )
    }

    private fun isSplitScreenDetectionEnabled(): Boolean {
        return getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE).getBoolean(
            TestConstants.PREF_SPLIT_SCREEN_DETECTION_ENABLED,
            true
        )
    }

    private fun isPinEntryFocusBypassActive(): Boolean {
        val until = getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE).getLong(
            TestConstants.PREF_PIN_ENTRY_FOCUS_BYPASS_UNTIL,
            0L
        )
        return until > System.currentTimeMillis()
    }

    private fun resetKioskModeForNewLaunch() {
        getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putBoolean(TestConstants.PREF_APP_LOCK_ENABLED, true)
            .apply()
    }

    private fun shouldLaunchReactNativeUi(): Boolean {
        val skipRnBoot = intent?.getBooleanExtra(EXTRA_SKIP_RN_UI_BOOT, false) ?: false
        if (skipRnBoot) {
            clearRnBootPending()
            return false
        }

        val prefs = getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE)
        val pending = prefs.getBoolean(PREF_RN_BOOT_PENDING, false)
        val pendingAt = prefs.getLong(PREF_RN_BOOT_PENDING_AT, 0L)
        if (pending) {
            val ageMs = System.currentTimeMillis() - pendingAt
            if (ageMs in 0 until RN_BOOT_FAIL_WINDOW_MS) {
                clearRnBootPending()
                return false
            }
            clearRnBootPending()
        }

        return true
    }

    private fun markRnBootPending() {
        getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putBoolean(PREF_RN_BOOT_PENDING, true)
            .putLong(PREF_RN_BOOT_PENDING_AT, System.currentTimeMillis())
            .apply()
    }

    private fun clearRnBootPending() {
        getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putBoolean(PREF_RN_BOOT_PENDING, false)
            .remove(PREF_RN_BOOT_PENDING_AT)
            .apply()
    }

    private fun restoreRecoveredSessionUi() {
        if (SessionState.currentRole != UserRole.STUDENT || SessionState.isSessionExpired()) {
            return
        }

        val recoveryReason = SessionStateStore.consumePendingRecoveryReason()
        if (!recoveryReason.isNullOrBlank()) {
            sessionLogger.append(
                TestConstants.EVENT_RESTART_RECOVERY,
                "Pemulihan sesi setelah restart/boot: $recoveryReason"
            )
        }

        val resumeUrl = SessionState.currentExamUrl
        if (resumeUrl.isNotBlank()) {
            FragmentNavigationTest.openExam(navController, resumeUrl)
        } else {
            navController.navigate(R.id.examFlowTest)
        }
    }
}
