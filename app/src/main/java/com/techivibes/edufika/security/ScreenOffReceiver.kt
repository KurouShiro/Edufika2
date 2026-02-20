package com.techivibes.edufika.security

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.RingtoneManager

class ScreenOffReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_SCREEN_OFF) {
            triggerAlarm(context)
        }
    }

    companion object {
        private var activeRingtone: android.media.Ringtone? = null

        fun triggerAlarm(context: Context) {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            forceMaxVolume(audioManager)

            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val ringtone = RingtoneManager.getRingtone(context, alarmUri)
            ringtone?.audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            runCatching { activeRingtone?.stop() }
            activeRingtone = ringtone
            ringtone?.play()
        }

        fun stopAlarm() {
            runCatching { activeRingtone?.stop() }
            activeRingtone = null
        }

        private fun forceMaxVolume(audioManager: AudioManager) {
            val streams = listOf(
                AudioManager.STREAM_ALARM,
                AudioManager.STREAM_NOTIFICATION,
                AudioManager.STREAM_RING,
                AudioManager.STREAM_MUSIC,
                AudioManager.STREAM_SYSTEM
            )
            streams.forEach { stream ->
                val maxVolume = audioManager.getStreamMaxVolume(stream)
                runCatching {
                    audioManager.setStreamVolume(stream, maxVolume, 0)
                }
            }
        }
    }
}
