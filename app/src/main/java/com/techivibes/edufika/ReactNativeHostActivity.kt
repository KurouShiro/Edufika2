package com.techivibes.edufika

import android.content.Intent
import android.os.Bundle
import android.os.SystemClock
import android.view.KeyEvent
import android.view.WindowManager
import android.util.Log
import android.widget.Toast
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.techivibes.edufika.data.SessionLogger
import com.techivibes.edufika.monitoring.FocusMonitorState
import com.techivibes.edufika.security.ScreenLock
import com.techivibes.edufika.utils.TestConstants

class ReactNativeHostActivity : ReactActivity() {

    companion object {
        private const val TAG = "ReactNativeHostActivity"
        private const val VOLUME_CHORD_WINDOW_MS = 450L
        private const val PREF_RN_BOOT_PENDING = "pref_rn_boot_pending"
        private const val PREF_RN_BOOT_PENDING_AT = "pref_rn_boot_pending_at"
    }

    private var volumeUpPressedAtMs: Long = 0L
    private var volumeDownPressedAtMs: Long = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        runCatching {
            // React Native activity should always bootstrap with null saved state.
            super.onCreate(null)
            resetKioskModeForNewLaunch()
            window.setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
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
        val kioskEnabled = getSharedPreferences(TestConstants.PREFS_NAME, MODE_PRIVATE)
            .getBoolean(TestConstants.PREF_APP_LOCK_ENABLED, true)
        if (kioskEnabled) {
            ScreenLock.apply(this)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        FocusMonitorState.hasWindowFocus = hasFocus
    }

    override fun onMultiWindowModeChanged(isInMultiWindowMode: Boolean) {
        super.onMultiWindowModeChanged(isInMultiWindowMode)
        FocusMonitorState.isMultiWindow = isInMultiWindowMode
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
