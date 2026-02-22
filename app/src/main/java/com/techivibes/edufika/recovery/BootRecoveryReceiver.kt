package com.techivibes.edufika.recovery

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.techivibes.edufika.data.SessionStateStore

class BootRecoveryReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        val action = intent.action ?: return
        if (
            action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            SessionStateStore.bind(context.applicationContext)
            SessionStateStore.markRecoveryPending(action)
        }
    }
}

