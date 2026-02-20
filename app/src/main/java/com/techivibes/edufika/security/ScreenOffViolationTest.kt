package com.techivibes.edufika.security

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import com.techivibes.edufika.data.SessionState

class ScreenOffViolationTest(
    private val context: Context,
    private val onViolation: () -> Unit
) {

    private var registered = false
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_SCREEN_OFF && SessionState.isStudentSessionActive()) {
                onViolation()
            }
        }
    }

    fun register() {
        if (registered) return
        ContextCompat.registerReceiver(
            context,
            receiver,
            IntentFilter(Intent.ACTION_SCREEN_OFF),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
        registered = true
    }

    fun unregister() {
        if (!registered) return
        runCatching { context.unregisterReceiver(receiver) }
        registered = false
    }
}
