package com.techivibes.edufika.security

import android.app.Activity
import android.os.Build
import android.view.View

object ScreenLock {

    fun apply(activity: Activity) {
        @Suppress("DEPRECATION")
        activity.window.decorView.systemUiVisibility =
            (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            runCatching { activity.startLockTask() }
        }
    }

    fun clear(activity: Activity) {
        @Suppress("DEPRECATION")
        activity.window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            runCatching { activity.stopLockTask() }
        }
    }
}
