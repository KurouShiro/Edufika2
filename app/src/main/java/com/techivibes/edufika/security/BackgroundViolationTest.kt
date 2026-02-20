package com.techivibes.edufika.security

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.techivibes.edufika.data.SessionState

class BackgroundViolationTest(private val onViolation: () -> Unit) : DefaultLifecycleObserver {

    override fun onStop(owner: LifecycleOwner) {
        if (SessionState.isStudentSessionActive()) {
            onViolation()
        }
    }
}
