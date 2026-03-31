package com.techivibes.edufika.updates

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import kotlin.system.exitProcess

object AppRestartHelper {
    fun restart(context: Context) {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            }
            ?: return

        Handler(Looper.getMainLooper()).post {
            context.startActivity(launchIntent)
            Handler(Looper.getMainLooper()).postDelayed({
                exitProcess(0)
            }, 200L)
        }
    }
}
