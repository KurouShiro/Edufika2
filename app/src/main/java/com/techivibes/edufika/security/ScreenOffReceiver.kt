package com.techivibes.edufika.security

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.SystemClock
import com.techivibes.edufika.R

class ScreenOffReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_SCREEN_OFF) {
            triggerAlarm(context)
        }
    }

    companion object {
        private const val ALARM_DEDUPE_WINDOW_MS = 2_500L
        private var activeMediaPlayer: MediaPlayer? = null
        private var lastAlarmTriggerElapsedMs: Long = 0L

        fun triggerAlarm(context: Context) {
            val nowMs = SystemClock.elapsedRealtime()
            if (nowMs - lastAlarmTriggerElapsedMs < ALARM_DEDUPE_WINDOW_MS) {
                return
            }
            lastAlarmTriggerElapsedMs = nowMs

            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            forceMaxVolume(audioManager)

            runCatching { activeMediaPlayer?.stop() }
            runCatching { activeMediaPlayer?.release() }

            val mediaPlayer = MediaPlayer.create(context.applicationContext, R.raw.fahhhhhhhhhhhhhh) ?: return
            mediaPlayer.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            mediaPlayer.isLooping = false
            mediaPlayer.setOnCompletionListener { player ->
                runCatching { player.release() }
                if (activeMediaPlayer === player) {
                    activeMediaPlayer = null
                }
            }
            activeMediaPlayer = mediaPlayer
            mediaPlayer.start()
        }

        fun stopAlarm() {
            runCatching { activeMediaPlayer?.stop() }
            runCatching { activeMediaPlayer?.release() }
            activeMediaPlayer = null
            lastAlarmTriggerElapsedMs = 0L
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
