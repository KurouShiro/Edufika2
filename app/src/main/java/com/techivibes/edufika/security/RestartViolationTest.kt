package com.techivibes.edufika.security

import android.content.Context
import com.techivibes.edufika.utils.TestConstants

object RestartViolationTest {

    fun checkAndMarkLaunch(context: Context): Boolean {
        val prefs = context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
        val lastExitClean = prefs.getBoolean(TestConstants.PREF_LAST_EXIT_CLEAN, true)
        prefs.edit().putBoolean(TestConstants.PREF_LAST_EXIT_CLEAN, false).apply()
        return !lastExitClean
    }

    fun markCleanExit(context: Context, isFinishing: Boolean) {
        if (!isFinishing) return
        val prefs = context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(TestConstants.PREF_LAST_EXIT_CLEAN, true).apply()
    }
}
