package com.techivibes.edufika.monitoring

import android.content.Context
import android.provider.Settings
import com.techivibes.edufika.data.SessionState
import com.techivibes.edufika.utils.TestConstants

class FocusMonitor(
    private val context: Context,
    private val onRisk: (event: String, detail: String) -> Unit
) {
    companion object {
        // Known assistive services that should not be treated as cheating by default.
        private val BENIGN_ACCESSIBILITY_HINTS = listOf(
            "com.google.android.marvin.talkback",
            "com.google.android.accessibility",
            "com.android.talkback",
            "com.samsung.accessibility",
            "com.coloros.accessibility",
            "com.oplus.accessibility",
            "com.miui.accessibility",
            "com.vivo.accessibility",
            "com.realme.accessibility"
        )

        // Heuristic signals commonly seen in automation/remote-control tooling.
        private val SUSPICIOUS_ACCESSIBILITY_HINTS = listOf(
            "autoclick",
            "auto_click",
            "macro",
            "remote",
            "automation",
            "script",
            "assistivetouch"
        )
    }

    fun onWindowFocusChanged(hasFocus: Boolean) {
        FocusMonitorState.hasWindowFocus = hasFocus
        // Focus-loss risk is handled by host activities with debounce + IME checks.
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
        val examActive = SessionState.isStudentExamSessionActive()
        val overlayRisk = hasOverlayRisk()
        val accessibilityRisk = hasSuspiciousAccessibility()
        val previousOverlayRisk = FocusMonitorState.overlayRiskDetected
        val previousAccessibilityRisk = FocusMonitorState.accessibilityRiskDetected
        FocusMonitorState.overlayRiskDetected = overlayRisk
        FocusMonitorState.accessibilityRiskDetected = accessibilityRisk
        if (examActive && overlayRisk && !previousOverlayRisk) {
            onRisk(
                TestConstants.EVENT_OVERLAY_DETECTED,
                "FocusMonitor: overlay capability terdeteksi."
            )
        }
        if (examActive && accessibilityRisk && !previousAccessibilityRisk) {
            onRisk(
                TestConstants.EVENT_ACCESSIBILITY_ACTIVE,
                "FocusMonitor: accessibility service aktif."
            )
        }
    }

    private fun hasOverlayRisk(): Boolean {
        // Overlay permission alone is too noisy; only treat as risk when focus is gone
        // and suspicious accessibility tooling is also present.
        if (!Settings.canDrawOverlays(context)) return false
        if (FocusMonitorState.hasWindowFocus) return false
        return hasSuspiciousAccessibility()
    }

    private fun hasSuspiciousAccessibility(): Boolean {
        val enabled = runCatching {
            Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            )
        }.getOrNull().orEmpty()
        if (enabled.isBlank()) return false

        val services = enabled
            .split(":")
            .map { it.trim().lowercase() }
            .filter { it.isNotBlank() }
        if (services.isEmpty()) return false

        return services.any { service ->
            val benign = BENIGN_ACCESSIBILITY_HINTS.any { hint -> service.contains(hint) }
            if (benign) {
                false
            } else {
                SUSPICIOUS_ACCESSIBILITY_HINTS.any { hint -> service.contains(hint) }
            }
        }
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
