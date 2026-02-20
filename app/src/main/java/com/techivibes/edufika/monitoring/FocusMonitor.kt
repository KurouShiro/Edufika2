package com.techivibes.edufika.monitoring

import android.content.Context
import android.provider.Settings
import com.techivibes.edufika.utils.TestConstants

class FocusMonitor(
    private val context: Context,
    private val onRisk: (event: String, detail: String) -> Unit
) {

    fun onWindowFocusChanged(hasFocus: Boolean) {
        FocusMonitorState.hasWindowFocus = hasFocus
        if (!hasFocus) {
            onRisk(
                TestConstants.EVENT_FOCUS_LOST,
                "FocusMonitor: window focus hilang."
            )
        }
    }

    fun onMultiWindowModeChanged(enabled: Boolean) {
        FocusMonitorState.isMultiWindow = enabled
        if (enabled) {
            onRisk(
                TestConstants.EVENT_MULTI_WINDOW,
                "FocusMonitor: multi-window aktif."
            )
        }
    }

    fun refreshSignals() {
        val overlayRisk = hasOverlayRisk()
        val accessibilityRisk = hasSuspiciousAccessibility()
        val previousOverlayRisk = FocusMonitorState.overlayRiskDetected
        val previousAccessibilityRisk = FocusMonitorState.accessibilityRiskDetected
        FocusMonitorState.overlayRiskDetected = overlayRisk
        FocusMonitorState.accessibilityRiskDetected = accessibilityRisk
        if (overlayRisk && !previousOverlayRisk) {
            onRisk(
                TestConstants.EVENT_OVERLAY_DETECTED,
                "FocusMonitor: overlay capability terdeteksi."
            )
        }
        if (accessibilityRisk && !previousAccessibilityRisk) {
            onRisk(
                TestConstants.EVENT_ACCESSIBILITY_ACTIVE,
                "FocusMonitor: accessibility service aktif."
            )
        }
    }

    private fun hasOverlayRisk(): Boolean {
        return Settings.canDrawOverlays(context)
    }

    private fun hasSuspiciousAccessibility(): Boolean {
        val enabled = runCatching {
            Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            )
        }.getOrNull().orEmpty()
        return enabled.isNotBlank()
    }
}

object FocusMonitorState {
    @Volatile
    var hasWindowFocus: Boolean = true

    @Volatile
    var isMultiWindow: Boolean = false

    @Volatile
    var overlayRiskDetected: Boolean = false

    @Volatile
    var accessibilityRiskDetected: Boolean = false
}
