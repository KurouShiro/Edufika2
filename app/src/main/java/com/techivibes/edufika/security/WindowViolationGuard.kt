package com.techivibes.edufika.security

import android.os.SystemClock

class WindowViolationGuard(
    private val requiredConsecutiveSignals: Int = 3,
    private val detectionWindowMs: Long = 1_500L
) {

    data class Decision(
        val shouldLock: Boolean,
        val signalCount: Int,
        val hardSignalSeen: Boolean
    ) {
        fun summary(): String {
            return "signals=$signalCount hard=$hardSignalSeen lock=$shouldLock"
        }
    }

    private var signalCount = 0
    private var hardSignalSeen = false
    private var firstSignalAtMs = 0L
    private var lastSignalAtMs = 0L

    fun evaluate(snapshot: WindowModeDetector.Snapshot, examActive: Boolean): Decision {
        if (!examActive || !snapshot.hasAnySignal) {
            reset()
            return Decision(false, signalCount, hardSignalSeen)
        }

        val nowMs = SystemClock.elapsedRealtime()
        if (signalCount == 0 || nowMs - lastSignalAtMs > detectionWindowMs) {
            signalCount = 0
            hardSignalSeen = false
            firstSignalAtMs = nowMs
        }

        signalCount += 1
        if (snapshot.hasHardSignal) {
            hardSignalSeen = true
        }
        lastSignalAtMs = nowMs

        val insideWindow = nowMs - firstSignalAtMs <= detectionWindowMs
        val shouldLock = insideWindow && signalCount >= requiredConsecutiveSignals && hardSignalSeen
        if (shouldLock) {
            reset()
        }
        return Decision(shouldLock, signalCount, hardSignalSeen)
    }

    fun reset() {
        signalCount = 0
        hardSignalSeen = false
        firstSignalAtMs = 0L
        lastSignalAtMs = 0L
    }
}

