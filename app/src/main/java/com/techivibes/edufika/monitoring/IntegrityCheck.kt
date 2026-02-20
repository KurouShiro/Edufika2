package com.techivibes.edufika.monitoring

import android.os.Build
import android.os.Debug
import java.io.File

data class IntegrityReport(
    val rooted: Boolean,
    val emulator: Boolean,
    val debugger: Boolean,
    val score: Int,
    val details: String
)

object IntegrityCheck {

    fun evaluate(): IntegrityReport {
        val rooted = isRooted()
        val emulator = isEmulator()
        val debugger = Debug.isDebuggerConnected()

        var score = 0
        val detailParts = mutableListOf<String>()

        if (rooted) {
            score += 5
            detailParts += "rooted=true"
        }
        if (emulator) {
            score += 4
            detailParts += "emulator=true"
        }
        if (debugger) {
            score += 3
            detailParts += "debugger=true"
        }

        if (detailParts.isEmpty()) {
            detailParts += "integrity_normal"
        }

        return IntegrityReport(
            rooted = rooted,
            emulator = emulator,
            debugger = debugger,
            score = score,
            details = detailParts.joinToString(separator = ", ")
        )
    }

    private fun isRooted(): Boolean {
        val testKeys = Build.TAGS?.contains("test-keys") == true
        val suBinary = listOf(
            "/system/bin/su",
            "/system/xbin/su",
            "/sbin/su",
            "/system/app/Superuser.apk",
            "/system/bin/.ext/su"
        ).any { File(it).exists() }
        return testKeys || suBinary
    }

    private fun isEmulator(): Boolean {
        val fingerprint = Build.FINGERPRINT.lowercase()
        val model = Build.MODEL.lowercase()
        val product = Build.PRODUCT.lowercase()
        val manufacturer = Build.MANUFACTURER.lowercase()
        val hardware = Build.HARDWARE.lowercase()
        return fingerprint.contains("generic") ||
            fingerprint.contains("emulator") ||
            model.contains("emulator") ||
            model.contains("android sdk built for x86") ||
            product.contains("sdk") ||
            manufacturer.contains("genymotion") ||
            hardware.contains("goldfish") ||
            hardware.contains("ranchu")
    }
}
