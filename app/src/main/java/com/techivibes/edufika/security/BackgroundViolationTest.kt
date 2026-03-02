package com.techivibes.edufika.security

import android.os.Handler
import android.os.Looper
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.techivibes.edufika.data.SessionState

class BackgroundViolationTest(private val onViolation: () -> Unit) : DefaultLifecycleObserver {
    companion object {
        private const val BACKGROUND_VIOLATION_DELAY_MS = 1_200L
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var pending = false
    private val pendingViolation = Runnable {
        pending = false
        if (SessionState.isStudentExamSessionActive()) {
            onViolation()
        }
    }

    override fun onStart(owner: LifecycleOwner) {
        clearPending()
    }

    override fun onStop(owner: LifecycleOwner) {
        if (!SessionState.isStudentExamSessionActive()) return
        if (pending) return
        pending = true
        mainHandler.postDelayed(pendingViolation, BACKGROUND_VIOLATION_DELAY_MS)
    }

    override fun onDestroy(owner: LifecycleOwner) {
        clearPending()
    }

    private fun clearPending() {
        if (!pending) return
        mainHandler.removeCallbacks(pendingViolation)
        pending = false
    }
}
