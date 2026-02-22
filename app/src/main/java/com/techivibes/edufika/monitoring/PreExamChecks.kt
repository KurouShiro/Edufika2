package com.techivibes.edufika.monitoring

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager

data class PreExamCheckResult(
    val batteryPercent: Int,
    val charging: Boolean,
    val networkConnected: Boolean,
    val networkValidated: Boolean,
    val isBlocking: Boolean,
    val message: String
)

object PreExamChecks {
    private const val MIN_BATTERY_PERCENT = 30

    fun evaluate(context: Context): PreExamCheckResult {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val batteryPercent = if (level > 0 && scale > 0) ((level * 100f) / scale).toInt() else -1

        val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL

        val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val activeNetwork = connectivity.activeNetwork
        val capabilities = activeNetwork?.let { connectivity.getNetworkCapabilities(it) }
        val networkConnected = capabilities != null && (
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
            )
        val networkValidated = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true

        if (!networkConnected) {
            return PreExamCheckResult(
                batteryPercent = batteryPercent,
                charging = charging,
                networkConnected = false,
                networkValidated = false,
                isBlocking = true,
                message = "Tidak ada koneksi internet aktif."
            )
        }

        if (batteryPercent in 0 until MIN_BATTERY_PERCENT && !charging) {
            return PreExamCheckResult(
                batteryPercent = batteryPercent,
                charging = false,
                networkConnected = true,
                networkValidated = networkValidated,
                isBlocking = true,
                message = "Baterai ${batteryPercent}% tanpa charger. Sambungkan daya sebelum ujian."
            )
        }

        if (!networkValidated) {
            return PreExamCheckResult(
                batteryPercent = batteryPercent,
                charging = charging,
                networkConnected = true,
                networkValidated = false,
                isBlocking = false,
                message = "Jaringan terhubung tapi belum tervalidasi stabil."
            )
        }

        return PreExamCheckResult(
            batteryPercent = batteryPercent,
            charging = charging,
            networkConnected = true,
            networkValidated = true,
            isBlocking = false,
            message = "Pre-check OK"
        )
    }
}

