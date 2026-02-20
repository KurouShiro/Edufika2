package com.techivibes.edufika.utils

import android.app.Activity
import android.content.Context
import android.net.Uri
import android.widget.Toast
import com.techivibes.edufika.security.ScreenLock
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object TestUtils {

    fun showToast(context: Context, message: String) {
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
    }

    fun timestampNow(): String {
        return SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
    }

    fun timestampFromMillis(millis: Long): String {
        return SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date(millis))
    }

    fun normalizeUrl(raw: String): String {
        val value = raw.trim()
        if (value.isEmpty()) {
            return value
        }
        return if (value.startsWith("http://") || value.startsWith("https://")) {
            value
        } else {
            "https://$value"
        }
    }

    fun extractExamUrl(raw: String): String {
        val value = raw.trim()
        if (value.isBlank()) {
            return ""
        }

        val parsed = Uri.parse(value)
        val queryUrl = parsed.getQueryParameter("url")
        if (!queryUrl.isNullOrBlank()) {
            return normalizeUrl(queryUrl)
        }

        val firstHttpMatch = Regex("""https?://[^\s"'<>]+""").find(value)?.value
        if (!firstHttpMatch.isNullOrBlank()) {
            return normalizeUrl(firstHttpMatch)
        }

        return normalizeUrl(value)
    }

    fun disableKioskForDebug(context: Context, activity: Activity? = null) {
        context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(TestConstants.PREF_APP_LOCK_ENABLED, false)
            .apply()
        activity?.let { ScreenLock.clear(it) }
    }

    fun enableKiosk(context: Context, activity: Activity? = null) {
        context.getSharedPreferences(TestConstants.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(TestConstants.PREF_APP_LOCK_ENABLED, true)
            .apply()
        activity?.let { ScreenLock.apply(it) }
    }

    fun shutdownApp(activity: Activity, disableKioskForCurrentRun: Boolean) {
        if (disableKioskForCurrentRun) {
            disableKioskForDebug(activity, activity)
        }
        activity.moveTaskToBack(true)
        activity.finishAffinity()
    }
}
