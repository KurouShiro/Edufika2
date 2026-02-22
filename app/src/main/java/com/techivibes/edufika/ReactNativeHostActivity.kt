package com.techivibes.edufika

import android.os.Bundle
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
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        runCatching {
            // React Native activity should always bootstrap with null saved state.
            super.onCreate(null)
        }.onFailure { throwable ->
            Log.e(TAG, "Failed to launch React Native UI", throwable)
            SessionLogger(this).append(
                "RN",
                "Host launch failure: ${throwable.javaClass.simpleName}: ${throwable.message.orEmpty()}"
            )
            Toast.makeText(this, "React Native gagal dijalankan.", Toast.LENGTH_SHORT).show()
            finish()
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
}
