package com.techivibes.edufika

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import android.view.WindowManager
import android.util.Log
import android.widget.Toast
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.techivibes.edufika.data.SessionLogger
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.data.SessionStateStore
import com.techivibes.edufika.monitoring.FocusMonitorState
import com.techivibes.edufika.security.ScreenLock
import com.techivibes.edufika.security.ScreenOffReceiver
import com.techivibes.edufika.security.ScreenOffViolationTest
import com.techivibes.edufika.security.WindowModeDetector
import com.techivibes.edufika.security.WindowViolationGuard
import com.techivibes.edufika.utils.TestConstants

class ReactNativeHostActivity : ReactActivity() {

    companion object {
        private const val TAG = "ReactNativeHostActivity"
        private const val VOLUME_CHORD_WINDOW_MS = 450L
        private const val PREF_RN_BOOT_PENDING = "pref_rn_boot_pending"
        private const val PREF_RN_BOOT_PENDING_AT = "pref_rn_boot_pending_at"
        private const val MULTI_WINDOW_LOCK_REASON =
            "Multi-window/split-screen terdeteksi. Sesi dikunci demi integritas ujian."
        private const val FOCUS_LOSS_LOCK_REASON =
            "Aplikasi kehilangan fokus saat sesi ujian aktif."
        private const val FOCUS_LOSS_LOCK_DELAY_MS = 800L
    }

    private var volumeUpPressedAtMs: Long = 0L
    private var volumeDownPressedAtMs: Long = 0L
    private lateinit var screenOffViolationTest: ScreenOffViolationTest
    private val windowViolationGuard = WindowViolationGuard()
    private val focusLossHandler = Handler(Looper.getMainLooper())
    private var focusLossLockPending = false

    override fun onCreate(savedInstanceState: Bundle?) {
        runCatching {
            // React Native activity should always bootstrap with null saved state.
            super.onCreate(null)
            SessionStateStore.restore()
            resetKioskModeForNewLaunch()
            window.setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
            screenOffViolationTest = ScreenOffViolationTest(this) {
                if (!isViolationSystemEnabled()) {
                    return@ScreenOffViolationTest
                }
                val reason = "ScreenOffViolationTest: layar mati saat ujian aktif."
                SessionLogger(this).append(TestConstants.EVENT_FOCUS_LOST, reason)
                ScreenOffReceiver.triggerAlarm(this)
                sendBroadcast(
                    Intent(TestConstants.ACTION_SESSION_LOCKED)
                        .putExtra(TestConstants.EXTRA_LOCK_REASON, reason)
                )
            }
            screenOffViolationTest.register()
        }.onFailure { throwable ->
            Log.e(TAG, "Failed to launch React Native UI", throwable)
            SessionLogger(this).append(
                "RN",
                "Host launch failure: ${throwable.javaClass.simpleName}: ${throwable.message.orEmpty()}"
            )
            Toast.makeText(this, "React Native gagal dijalankan.", Toast.LENGTH_SHORT).show()
            fallbackToNativeUi()
        }
    }

    override fun getMainComponentName(): String = "EdufikaRN"

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return DefaultReactActivityDelegate(
            this,
            mainComponentName,
            BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        )
    }

    override fun onResume() {
        super.onResume()
        clearRnBootPending()
        FocusMonitorState.hasWindowFocus = true
        FocusMonitorState.isMultiWindow = isInMultiWindowMode
        if (isKioskModeEnabled()) {
            ScreenLock.apply(this)
            if (isViolationSystemEnabled() && isSplitScreenDetectionEnabled()) {
                enforceSingleWindowMode("onResume")
            }
        }
    }

    override fun onDestroy() {
        if (::screenOffViolationTest.isInitialized) {
            screenOffViolationTest.unregister()
        }
        clearFocusLossLockCheck()
        windowViolationGuard.reset()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        FocusMonitorState.hasWindowFocus = hasFocus
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
        FocusMonitorState.isMultiWindow = isInMultiWindowMode
        if (
            isInMultiWindowMode &&
            isKioskModeEnabled() &&
            isViolationSystemEnabled() &&
            isSplitScreenDetectionEnabled()
        ) {
            enforceSingleWindowMode("onMultiWindowModeChanged")
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            if ((event?.repeatCount ?: 0) > 0) {
                return true
            }
            registerVolumeChordKey(keyCode)
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun registerVolumeChordKey(keyCode: Int) {
        val nowMs = SystemClock.elapsedRealtime()
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            volumeUpPressedAtMs = nowMs
        } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            volumeDownPressedAtMs = nowMs
        }

        if (volumeUpPressedAtMs <= 0L || volumeDownPressedAtMs <= 0L) {
            return
        }

        val deltaMs = kotlin.math.abs(volumeUpPressedAtMs - volumeDownPressedAtMs)
        if (deltaMs <= VOLUME_CHORD_WINDOW_MS) {
            volumeUpPressedAtMs = 0L
            volumeDownPressedAtMs = 0L
            deactivateReactNativeUi()
        }
    }

    private fun deactivateReactNativeUi() {
        SessionLogger(this).append("RN", "Dual-volume keybind triggered. Returning to native UI.")
        Toast.makeText(this, "RN UI deactivated. Returning to native UI.", Toast.LENGTH_SHORT).show()
        fallbackToNativeUi()
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

        SessionLogger(this).append(
            "KIOSK",
            "Split-screen detected in RN host ($source). Forcing lock. ${snapshot.summary()} ${decision.summary()}"
        )
        ScreenOffReceiver.triggerAlarm(this)
        sendBroadcast(
            Intent(TestConstants.ACTION_SESSION_LOCKED)
                .putExtra(TestConstants.EXTRA_LOCK_REASON, MULTI_WINDOW_LOCK_REASON)
        )

        // Best-effort reclaim. Android does not allow third-party apps to force-stop arbitrary packages.
        runCatching { ScreenLock.apply(this) }
        runCatching {
            val relaunchIntent = Intent(this, ReactNativeHostActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(relaunchIntent)
        }
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
                    SessionLogger(this).append(
                        "KIOSK",
                        "Focus loss ignored due to active proctor PIN entry bypass. source=$source"
                    )
                    return@postDelayed
                }
                val snapshot = WindowModeDetector.capture(this)
                if (snapshot.imeVisible) {
                    SessionLogger(this).append(
                        "KIOSK",
                        "Focus loss ignored due to IME visibility in RN host ($source). ${snapshot.summary()}"
                    )
                    return@postDelayed
                }
                SessionLogger(this).append(
                    "KIOSK",
                    "Focus loss sustained in RN host ($source). Forcing lock. ${snapshot.summary()}"
                )
                ScreenOffReceiver.triggerAlarm(this)
                sendBroadcast(
                    Intent(TestConstants.ACTION_SESSION_LOCKED)
                        .putExtra(TestConstants.EXTRA_LOCK_REASON, FOCUS_LOSS_LOCK_REASON)
                )
                runCatching { ScreenLock.apply(this) }
            },
            FOCUS_LOSS_LOCK_DELAY_MS
        )
    }

    private fun clearFocusLossLockCheck() {
        focusLossLockPending = false
        focusLossHandler.removeCallbacksAndMessages(null)
    }

    private fun isKioskModeEnabled(): Boolean {
        return getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE)
            .getBoolean(TestConstants.PREF_APP_LOCK_ENABLED, true)
    }

    private fun isViolationSystemEnabled(): Boolean {
        return getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE)
            .getBoolean(TestConstants.PREF_VIOLATION_SYSTEM_ENABLED, true)
    }

    private fun isSplitScreenDetectionEnabled(): Boolean {
        return getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE)
            .getBoolean(TestConstants.PREF_SPLIT_SCREEN_DETECTION_ENABLED, true)
    }

    private fun isPinEntryFocusBypassActive(): Boolean {
        val until = getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE)
            .getLong(TestConstants.PREF_PIN_ENTRY_FOCUS_BYPASS_UNTIL, 0L)
        return until > System.currentTimeMillis()
    }

    private fun fallbackToNativeUi() {
        clearRnBootPending()
        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra(MainActivity.EXTRA_SKIP_RN_UI_BOOT, true)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        startActivity(intent)
        finish()
    }

    private fun resetKioskModeForNewLaunch() {
        getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putBoolean(TestConstants.PREF_APP_LOCK_ENABLED, true)
            .apply()
    }

    private fun clearRnBootPending() {
        getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putBoolean(PREF_RN_BOOT_PENDING, false)
            .remove(PREF_RN_BOOT_PENDING_AT)
            .apply()
    }
}
